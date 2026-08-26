"""Lightweight SHACL-to-SPARQL compiler.

Parses an uploaded SHACL shapes graph (Turtle) and translates each node
shape's constraints into standalone SPARQL SELECT queries that find
violating focus nodes when run against a data graph. Every query is
self-contained (full IRIs, no external PREFIX needed) and independent, so
the caller can execute them one at a time against any SPARQL endpoint and
scope/filter the results afterwards (e.g. restrict to one boxology) without
touching the query text.

Supported per sh:property shape: sh:minCount, sh:maxCount, sh:class,
sh:datatype, sh:nodeKind (IRI/Literal/BlankNode/...), sh:hasValue, sh:in,
sh:pattern (+sh:flags), sh:minLength/sh:maxLength, sh:min/maxInclusive,
sh:min/maxExclusive, and sh:qualifiedValueShape + sh:qualifiedMinCount /
sh:qualifiedMaxCount (only when the referenced shape itself sticks to the
constraints above, at most one sh:node indirection deep). Node-level
sh:sparql constraints are passed through as-is, since a SHACL-SPARQL
sh:select query is already a self-contained "SELECT $this WHERE {...}"
query. Anything else encountered is reported back as an "unsupported"
check (with a human-readable reason) instead of being silently skipped or
mistranslated.

Path support is intentionally narrow: a direct predicate IRI, or a single
level of [ sh:inversePath <iri> ]. Sequence/alternative paths etc. are
reported as unsupported.
"""

import rdflib
from rdflib import BNode, Literal, URIRef
from rdflib.namespace import Namespace

SH = Namespace("http://www.w3.org/ns/shacl#")

_SEVERITY_NAMES = {
    SH.Violation: "Violation",
    SH.Warning: "Warning",
    SH.Info: "Info",
}

_NODE_KIND_FILTERS = {
    str(SH.IRI): "!isIRI(%s)",
    str(SH.Literal): "!isLiteral(%s)",
    str(SH.BlankNode): "!isBlank(%s)",
    str(SH.BlankNodeOrIRI): "isLiteral(%s)",
    str(SH.BlankNodeOrLiteral): "isIRI(%s)",
    str(SH.IRIOrLiteral): "isBlank(%s)",
}

_RANGE_CONSTRAINTS = [
    (SH.minLength, "minLength", "STRLEN(STR(%s))", "<"),
    (SH.maxLength, "maxLength", "STRLEN(STR(%s))", ">"),
    (SH.minInclusive, "minInclusive", "%s", "<"),
    (SH.maxInclusive, "maxInclusive", "%s", ">"),
    (SH.minExclusive, "minExclusive", "%s", "<="),
    (SH.maxExclusive, "maxExclusive", "%s", ">="),
]

_METADATA_PREDICATES = {SH.message, SH.severity, SH.name, SH.description, SH.order, SH.group, SH.path}

_HANDLED_PROPERTY_PREDICATES = (
    {
        SH.minCount, SH.maxCount, SH["class"], SH.datatype, SH.nodeKind, SH.hasValue, SH["in"],
        SH.pattern, SH.flags, SH.qualifiedValueShape, SH.qualifiedMinCount, SH.qualifiedMaxCount,
        SH.qualifiedValueShapesDisjoint,
    }
    | {p for p, _, _, _ in _RANGE_CONSTRAINTS}
    | _METADATA_PREDICATES
)


class ShaclCompileError(Exception):
    pass


def local_name(term) -> str:
    text = str(term)
    if "#" in text:
        return text.rsplit("#", 1)[-1]
    return text.rstrip("/").rsplit("/", 1)[-1] or text


def _literal_to_sparql(lit: Literal) -> str:
    escaped = str(lit).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    out = f'"{escaped}"'
    if lit.language:
        out += f"@{lit.language}"
    elif lit.datatype:
        out += f"^^<{lit.datatype}>"
    return out


def _term_to_sparql(term) -> str:
    if isinstance(term, URIRef):
        return f"<{term}>"
    if isinstance(term, Literal):
        return _literal_to_sparql(term)
    raise ShaclCompileError(f"Cannot render blank node {term!r} as a SPARQL value")


def _render_path(graph, path_node):
    """(predicate_sparql, is_inverse), or (None, None) if unsupported."""
    if isinstance(path_node, URIRef):
        return f"<{path_node}>", False
    if isinstance(path_node, BNode):
        inverse = graph.value(path_node, SH.inversePath)
        if isinstance(inverse, URIRef):
            return f"<{inverse}>", True
    return None, None


def _describe_path(graph, path_node):
    if isinstance(path_node, URIRef):
        return local_name(path_node)
    if isinstance(path_node, BNode):
        inverse = graph.value(path_node, SH.inversePath)
        if inverse is not None:
            return f"^{local_name(inverse)}"
    return "(unsupported path)"


def _value_triple(this_var, predicate_sparql, value_var, is_inverse) -> str:
    if is_inverse:
        return f"{value_var} {predicate_sparql} {this_var} ."
    return f"{this_var} {predicate_sparql} {value_var} ."


def _target_pattern(this_var, target_classes, target_nodes) -> str:
    alternatives = [f"{this_var} a <{c}> ." for c in target_classes]
    if target_nodes:
        values = " ".join(_term_to_sparql(n) for n in target_nodes)
        alternatives.append(f"VALUES {this_var} {{ {values} }}")
    if not alternatives:
        raise ShaclCompileError("shape has no sh:targetClass or sh:targetNode")
    if len(alternatives) == 1:
        return alternatives[0]
    return "\n  UNION\n  ".join(f"{{ {a} }}" for a in alternatives)


def _as_int(term):
    try:
        return int(str(term))
    except (TypeError, ValueError):
        return None


def _check(shape_label, path_label, constraint_label, message, severity, sparql, kind="property"):
    return {
        "shapeName": shape_label,
        "path": path_label,
        "constraint": constraint_label,
        "message": message,
        "severity": severity,
        "kind": kind,
        "sparql": sparql,
    }


def _unsupported(shape_label, path_label, constraint_label, message, reason):
    return {
        "shapeName": shape_label,
        "path": path_label,
        "constraint": constraint_label,
        "message": message or reason,
        "severity": "Info",
        "kind": "unsupported",
        "sparql": None,
        "reason": reason,
    }


def _shape_constraints_as_filters(graph, shape_node, focus_var, depth=0):
    """Render `shape_node`'s own simple constraints (direct sh:class/datatype/
    hasValue, its sh:property list, and one further sh:node indirection) as a
    list of boolean SPARQL fragments over `focus_var`. None => unsupported."""
    if depth > 3:
        return None

    # sh:targetClass/etc only matter when a shape is validated as a top-level shape
    # (see compile_shapes_ttl); they don't affect whether an already-identified
    # candidate node conforms, so they're harmless to see on a shape reached via
    # sh:node/sh:qualifiedValueShape indirection - a shape can legitimately be both.
    ignorable_when_nested = {SH.targetClass, SH.targetNode, SH.targetSubjectsOf, SH.targetObjectsOf, SH.deactivated}
    direct_handled = (
        {SH["class"], SH.datatype, SH.hasValue, SH.node, SH.property, rdflib.RDF.type}
        | _METADATA_PREDICATES
        | ignorable_when_nested
    )
    if not set(graph.predicates(shape_node, None)).issubset(direct_handled):
        return None

    fragments = []

    cls = graph.value(shape_node, SH["class"])
    if cls is not None:
        fragments.append(f"EXISTS {{ {focus_var} a <{cls}> . }}")
    datatype = graph.value(shape_node, SH.datatype)
    if datatype is not None:
        fragments.append(f"(isLiteral({focus_var}) && datatype({focus_var}) = <{datatype}>)")
    has_value = graph.value(shape_node, SH.hasValue)
    if has_value is not None:
        fragments.append(f"({focus_var} = {_term_to_sparql(has_value)})")

    for i, ps in enumerate(graph.objects(shape_node, SH.property)):
        if not set(graph.predicates(ps, None)).issubset(_HANDLED_PROPERTY_PREDICATES):
            return None
        predicate_sparql, is_inverse = _render_path(graph, graph.value(ps, SH.path))
        if predicate_sparql is None:
            return None

        min_count = _as_int(graph.value(ps, SH.minCount))
        max_count = _as_int(graph.value(ps, SH.maxCount))
        p_cls = graph.value(ps, SH["class"])
        p_has_value = graph.value(ps, SH.hasValue)
        value_var = f"?__f{depth}_{i}"
        triple = _value_triple(focus_var, predicate_sparql, value_var, is_inverse)

        if p_has_value is not None:
            fixed_triple = _value_triple(focus_var, predicate_sparql, _term_to_sparql(p_has_value), is_inverse)
            fragments.append(f"EXISTS {{ {fixed_triple} }}")
        elif min_count is not None and min_count >= 1:
            if p_cls is not None:
                fragments.append(f"EXISTS {{ {triple} {value_var} a <{p_cls}> . }}")
            else:
                fragments.append(f"EXISTS {{ {triple} }}")
        elif min_count not in (None, 0):
            return None

        if max_count == 1:
            v2 = f"{value_var}b"
            t2 = _value_triple(focus_var, predicate_sparql, v2, is_inverse)
            fragments.append(f"NOT EXISTS {{ {triple} {t2} FILTER({value_var} != {v2}) }}")
        elif max_count is not None:
            return None

    referenced = graph.value(shape_node, SH.node)
    if referenced is not None:
        nested = _shape_constraints_as_filters(graph, referenced, focus_var, depth=depth + 1)
        if nested is None:
            return None
        fragments.extend(nested)

    return fragments


def _compile_qualified(graph, this_var, target_classes, target_nodes, predicate_sparql, is_inverse,
                        ps_node, shape_label, path_label, message, severity):
    qvs_node = graph.value(ps_node, SH.qualifiedValueShape)
    qmin = _as_int(graph.value(ps_node, SH.qualifiedMinCount))
    qmax = _as_int(graph.value(ps_node, SH.qualifiedMaxCount))
    if qmin is None and qmax is None:
        return None

    nested = _shape_constraints_as_filters(graph, qvs_node, "?__qval", depth=0)
    if nested is None:
        return _unsupported(
            shape_label, path_label, "qualifiedValueShape", message,
            "sh:qualifiedValueShape references a shape that uses constraint components this "
            "lightweight validator does not support (only sh:class/sh:datatype/sh:hasValue and "
            "simple sh:minCount>=1 / sh:maxCount=1 property constraints, one sh:node deep, are inlined).",
        )

    filter_expr = " && ".join(nested) if nested else "true"
    triple = _value_triple(this_var, predicate_sparql, "?__qval", is_inverse)
    # HAVING must repeat the aggregate expression rather than reference the
    # SELECT alias (?__qcount) - Virtuoso's SPARQL compiler rejects the alias
    # form ("used outside aggregate and not mentioned in GROUP BY") even
    # though some engines (e.g. rdflib) accept it.
    count_expr = "COUNT(DISTINCT ?__qval)"
    conditions = []
    if qmin is not None:
        conditions.append(f"{count_expr} < {qmin}")
    if qmax is not None:
        conditions.append(f"{count_expr} > {qmax}")

    sparql = (
        f"SELECT {this_var} (COUNT(DISTINCT ?__qval) AS ?__qcount) WHERE {{\n"
        f"  {_target_pattern(this_var, target_classes, target_nodes)}\n"
        f"  OPTIONAL {{\n"
        f"    {triple}\n"
        f"    FILTER({filter_expr})\n"
        f"  }}\n"
        f"}}\n"
        f"GROUP BY {this_var}\n"
        f"HAVING ({' || '.join(conditions)})"
    )
    return _check(shape_label, path_label, "qualifiedValueShape", message, severity, sparql)


def _compile_property_shape(graph, shape_label, target_classes, target_nodes, ps_node):
    this_var = "?this"
    value_var = "?value"
    message_term = graph.value(ps_node, SH.message)
    message = str(message_term) if message_term is not None else None
    severity = _SEVERITY_NAMES.get(graph.value(ps_node, SH.severity), "Violation")

    path_node = graph.value(ps_node, SH.path)
    path_label = _describe_path(graph, path_node)
    predicate_sparql, is_inverse = _render_path(graph, path_node)

    if predicate_sparql is None:
        return [_unsupported(shape_label, path_label, "path", message,
                              "Only a direct predicate or a single-level sh:inversePath is supported as sh:path.")]

    checks = []

    def target():
        return _target_pattern(this_var, target_classes, target_nodes)

    predicates_present = set(graph.predicates(ps_node, None))
    unknown = predicates_present - _HANDLED_PROPERTY_PREDICATES
    if unknown:
        names = ", ".join(sorted(f"sh:{local_name(p)}" for p in unknown))
        checks.append(_unsupported(shape_label, path_label, names, message,
                                    f"Constraint component(s) not supported by this validator: {names}."))

    min_count = _as_int(graph.value(ps_node, SH.minCount))
    max_count = _as_int(graph.value(ps_node, SH.maxCount))
    if min_count is not None or max_count is not None:
        bits = [b for b in [f"minCount {min_count}" if min_count is not None else None,
                             f"maxCount {max_count}" if max_count is not None else None] if b]
        triple = _value_triple(this_var, predicate_sparql, value_var, is_inverse)
        # Repeat the aggregate expression in HAVING - see the matching comment
        # in _compile_qualified for why the ?__count alias can't be used here.
        count_expr = f"COUNT(DISTINCT {value_var})"
        conditions = [c for c in [
            f"{count_expr} < {min_count}" if min_count is not None else None,
            f"{count_expr} > {max_count}" if max_count is not None else None,
        ] if c]
        sparql = (
            f"SELECT {this_var} (COUNT(DISTINCT {value_var}) AS ?__count) WHERE {{\n"
            f"  {target()}\n"
            f"  OPTIONAL {{ {triple} }}\n"
            f"}}\n"
            f"GROUP BY {this_var}\n"
            f"HAVING ({' || '.join(conditions)})"
        )
        checks.append(_check(shape_label, path_label, " & ".join(bits),
                              message or f"{path_label} must satisfy {' and '.join(bits)}.", severity, sparql))

    cls = graph.value(ps_node, SH["class"])
    if cls is not None:
        triple = _value_triple(this_var, predicate_sparql, value_var, is_inverse)
        sparql = (
            f"SELECT DISTINCT {this_var} {value_var} WHERE {{\n"
            f"  {target()}\n"
            f"  {triple}\n"
            f"  FILTER NOT EXISTS {{ {value_var} a <{cls}> . }}\n"
            f"}}"
        )
        checks.append(_check(shape_label, path_label, f"class {local_name(cls)}",
                              message or f"Every value of {path_label} must be a {local_name(cls)}.", severity, sparql))

    datatype = graph.value(ps_node, SH.datatype)
    if datatype is not None:
        triple = _value_triple(this_var, predicate_sparql, value_var, is_inverse)
        sparql = (
            f"SELECT DISTINCT {this_var} {value_var} WHERE {{\n"
            f"  {target()}\n"
            f"  {triple}\n"
            f"  FILTER (!isLiteral({value_var}) || datatype({value_var}) != <{datatype}>)\n"
            f"}}"
        )
        checks.append(_check(shape_label, path_label, f"datatype {local_name(datatype)}",
                              message or f"Every value of {path_label} must have datatype {local_name(datatype)}.", severity, sparql))

    has_value = graph.value(ps_node, SH.hasValue)
    if has_value is not None:
        fixed_triple = _value_triple(this_var, predicate_sparql, _term_to_sparql(has_value), is_inverse)
        sparql = (
            f"SELECT DISTINCT {this_var} WHERE {{\n"
            f"  {target()}\n"
            f"  FILTER NOT EXISTS {{ {fixed_triple} }}\n"
            f"}}"
        )
        checks.append(_check(shape_label, path_label, "hasValue",
                              message or f"{path_label} must include the required value.", severity, sparql))

    in_list_head = graph.value(ps_node, SH["in"])
    if in_list_head is not None:
        items = list(graph.items(in_list_head))
        if items:
            rendered = ", ".join(_term_to_sparql(it) for it in items)
            triple = _value_triple(this_var, predicate_sparql, value_var, is_inverse)
            sparql = (
                f"SELECT DISTINCT {this_var} {value_var} WHERE {{\n"
                f"  {target()}\n"
                f"  {triple}\n"
                f"  FILTER ({value_var} NOT IN ({rendered}))\n"
                f"}}"
            )
            checks.append(_check(shape_label, path_label, "in",
                                  message or f"Every value of {path_label} must be one of the allowed values.", severity, sparql))

    pattern = graph.value(ps_node, SH.pattern)
    if pattern is not None:
        flags = graph.value(ps_node, SH.flags)
        triple = _value_triple(this_var, predicate_sparql, value_var, is_inverse)
        flags_arg = f", {_literal_to_sparql(Literal(str(flags)))}" if flags is not None else ""
        sparql = (
            f"SELECT DISTINCT {this_var} {value_var} WHERE {{\n"
            f"  {target()}\n"
            f"  {triple}\n"
            f"  FILTER (!REGEX(STR({value_var}), {_literal_to_sparql(Literal(str(pattern)))}{flags_arg}))\n"
            f"}}"
        )
        checks.append(_check(shape_label, path_label, "pattern",
                              message or f"Every value of {path_label} must match the pattern {pattern}.", severity, sparql))

    node_kind = graph.value(ps_node, SH.nodeKind)
    if node_kind is not None:
        template = _NODE_KIND_FILTERS.get(str(node_kind))
        if template is None:
            checks.append(_unsupported(shape_label, path_label, "nodeKind", message,
                                        f"Unsupported sh:nodeKind value {local_name(node_kind)}."))
        else:
            triple = _value_triple(this_var, predicate_sparql, value_var, is_inverse)
            sparql = (
                f"SELECT DISTINCT {this_var} {value_var} WHERE {{\n"
                f"  {target()}\n"
                f"  {triple}\n"
                f"  FILTER ({template % value_var})\n"
                f"}}"
            )
            checks.append(_check(shape_label, path_label, f"nodeKind {local_name(node_kind)}",
                                  message or f"Every value of {path_label} must be a {local_name(node_kind)}.", severity, sparql))

    for pred, name, expr_tmpl, op in _RANGE_CONSTRAINTS:
        bound = graph.value(ps_node, pred)
        if bound is None:
            continue
        triple = _value_triple(this_var, predicate_sparql, value_var, is_inverse)
        bound_sparql = _term_to_sparql(bound) if isinstance(bound, Literal) else str(bound)
        expr = expr_tmpl % value_var
        sparql = (
            f"SELECT DISTINCT {this_var} {value_var} WHERE {{\n"
            f"  {target()}\n"
            f"  {triple}\n"
            f"  FILTER ({expr} {op} {bound_sparql})\n"
            f"}}"
        )
        checks.append(_check(shape_label, path_label, name,
                              message or f"Every value of {path_label} must satisfy {name} {bound}.", severity, sparql))

    if graph.value(ps_node, SH.qualifiedValueShape) is not None:
        qualified = _compile_qualified(graph, this_var, target_classes, target_nodes, predicate_sparql, is_inverse,
                                        ps_node, shape_label, path_label,
                                        message or f"{path_label} does not satisfy the required qualified shape.", severity)
        if qualified:
            checks.append(qualified)

    return checks


def _compile_node_sparql(graph, shape_label, node):
    message_term = graph.value(node, SH.message)
    message = str(message_term) if message_term is not None else "SPARQL-based constraint violated."
    severity = _SEVERITY_NAMES.get(graph.value(node, SH.severity), "Violation")
    select_text = graph.value(node, SH.select)
    if select_text is None:
        return _unsupported(shape_label, "(sh:sparql)", "sh:select", message, "sh:sparql constraint has no sh:select query.")

    prefix_lines = "\n".join(f"PREFIX {p}: <{ns}>" for p, ns in graph.namespaces() if p)
    sparql = f"{prefix_lines}\n{str(select_text)}"
    return _check(shape_label, "(sh:sparql)", "sh:sparql", message, severity, sparql, kind="sparql")


def compile_shapes_ttl(shapes_ttl: str) -> dict:
    graph = rdflib.Graph()
    try:
        graph.parse(data=shapes_ttl, format="turtle")
    except Exception as exc:  # noqa: BLE001 - arbitrary user-uploaded Turtle
        raise ShaclCompileError(f"Could not parse the file as Turtle/SHACL: {exc}") from exc

    shape_nodes = sorted(set(graph.subjects(rdflib.RDF.type, SH.NodeShape)), key=local_name)
    if not shape_nodes:
        raise ShaclCompileError("No sh:NodeShape found in the uploaded file.")

    checks = []
    checked_shape_count = 0
    for shape in shape_nodes:
        target_classes = list(graph.objects(shape, SH.targetClass))
        target_nodes = list(graph.objects(shape, SH.targetNode))
        if not target_classes and not target_nodes:
            continue  # library-only shape (only used via sh:node / sh:qualifiedValueShape)
        checked_shape_count += 1
        shape_label = local_name(shape)

        for ps in graph.objects(shape, SH.property):
            try:
                checks.extend(_compile_property_shape(graph, shape_label, target_classes, target_nodes, ps))
            except ShaclCompileError as exc:
                checks.append(_unsupported(shape_label, "?", "error", None, str(exc)))

        for sp in graph.objects(shape, SH.sparql):
            try:
                checks.append(_compile_node_sparql(graph, shape_label, sp))
            except ShaclCompileError as exc:
                checks.append(_unsupported(shape_label, "(sh:sparql)", "error", None, str(exc)))

    for i, check in enumerate(checks):
        check["id"] = f"{check['shapeName']}::{i}"

    return {"shapeCount": checked_shape_count, "checks": checks}

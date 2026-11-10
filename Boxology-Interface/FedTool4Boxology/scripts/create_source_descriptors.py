import pathlib
import sys

try:
    from DeTrusty.Molecule.MTCreation import DEFAULT_OUTPUT_PATH, create_rdfmts, logger
except ImportError:
    PACKAGE_DETRUSTY = str(pathlib.Path(__file__).parent.parent.resolve())
    sys.path.append(PACKAGE_DETRUSTY)
    from DeTrusty.Molecule.MTCreation import DEFAULT_OUTPUT_PATH, create_rdfmts, logger
    sys.path.remove(PACKAGE_DETRUSTY)

if __name__ == '__main__':
    create_rdfmts(['http://localhost:9092/sparql/', 'http://localhost:8890/sparql/'],
                  '../source_descriptors/rdfmts.ttl')

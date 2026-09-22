import React, { type Dispatch, type SetStateAction } from 'react';
import * as go from 'gojs';
import { useDialogs } from '../../hooks/useDialogs';
import { useToast } from '../Toast/ToastProvider';
import { getButtonStyle, getEmphasisButtonStyle, iconButtonStyle } from '../../styles/buttonStyles';
import { colors, radii, shadows, fontFamily } from '../../styles/theme';
import type { Presentation, PresentationRefinement } from '../../types/presentation';
import { computeExclusiveElementIds, getSelectedElementIds, removeExclusiveElements } from '../../utils/presentation';

interface PresentationPanelProps {
  diagramRef: React.RefObject<go.Diagram | null>;
  presentation: Presentation;
  setPresentation: Dispatch<SetStateAction<Presentation>>;
}

// Lightweight dashboard for the Core/Refinement presentation layer (see spec
// section 10). Card-based to match the rest of RightSidebar's visual language,
// but still just a list + a handful of buttons - no new framework.
export default function PresentationPanel({ diagramRef, presentation, setPresentation }: PresentationPanelProps) {
  const { promptAsync, confirmAsync } = useDialogs();
  const { showToast } = useToast();

  const handleSetCoreFromSelection = () => {
    const diagram = diagramRef.current;
    if (!diagram) return;
    const ids = getSelectedElementIds(diagram);
    if (ids.length === 0) {
      showToast('Select one or more diagram elements first.', 'warning');
      return;
    }
    setPresentation((prev) => ({
      ...prev,
      core: { id: prev.core?.id ?? 'core', label: prev.core?.label ?? 'Core System', elementIds: ids },
    }));
    showToast(`Core set to ${ids.length} element(s).`, 'success');
  };

  const handleClearCore = () => {
    setPresentation((prev) => ({ ...prev, core: null }));
  };

  const handleCreateRefinement = async () => {
    const diagram = diagramRef.current;
    if (!diagram) return;
    const ids = getSelectedElementIds(diagram);
    if (ids.length === 0) {
      showToast('Select one or more diagram elements first.', 'warning');
      return;
    }
    const label = await promptAsync('Refinement name:', `Refinement ${presentation.refinements.length + 1}`);
    if (!label) return;

    setPresentation((prev) => ({
      ...prev,
      refinements: [
        ...prev.refinements,
        { id: `refinement_${Date.now()}`, label: label.trim(), elementIds: ids, visible: true },
      ],
    }));
  };

  const handleRenameRefinement = async (refinement: PresentationRefinement) => {
    const label = await promptAsync('Refinement name:', refinement.label);
    if (label === null) return;
    const name = label.trim();
    if (!name) {
      showToast('Refinement name cannot be empty.', 'warning');
      return;
    }
    setPresentation((prev) => ({
      ...prev,
      refinements: prev.refinements.map((r) => (r.id === refinement.id ? { ...r, label: name } : r)),
    }));
  };

  const handleAddSelectionToRefinement = (refinementId: string) => {
    const diagram = diagramRef.current;
    if (!diagram) return;
    const ids = getSelectedElementIds(diagram);
    if (ids.length === 0) {
      showToast('Select one or more diagram elements first.', 'warning');
      return;
    }
    setPresentation((prev) => ({
      ...prev,
      refinements: prev.refinements.map((r) =>
        r.id === refinementId ? { ...r, elementIds: Array.from(new Set([...r.elementIds, ...ids])) } : r
      ),
    }));
  };

  const handleToggleVisible = (refinementId: string) => {
    setPresentation((prev) => ({
      ...prev,
      refinements: prev.refinements.map((r) => (r.id === refinementId ? { ...r, visible: !r.visible } : r)),
    }));
  };

  const handleRemoveRefinement = async (refinementId: string) => {
    const diagram = diagramRef.current;
    if (!diagram) return;
    const ok = await confirmAsync('Remove this refinement and delete any diagram elements it exclusively owns?');
    if (!ok) return;

    const exclusiveIds = computeExclusiveElementIds(presentation, refinementId);
    removeExclusiveElements(diagram, exclusiveIds);
    setPresentation((prev) => ({ ...prev, refinements: prev.refinements.filter((r) => r.id !== refinementId) }));
  };

  const handleShowAll = () => {
    setPresentation((prev) => ({ ...prev, refinements: prev.refinements.map((r) => ({ ...r, visible: true })) }));
  };

  const handleHideAll = () => {
    setPresentation((prev) => ({ ...prev, refinements: prev.refinements.map((r) => ({ ...r, visible: false })) }));
  };

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 14,
        background: colors.surface.panel,
        borderRadius: radii.xl,
        border: `1px solid ${colors.surface.border}`,
        boxShadow: shadows.sm,
        fontFamily,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, color: colors.text.primary, marginBottom: 4 }}>
        Design Structure
      </div>
      <p style={{ fontSize: 11.5, lineHeight: 1.5, color: colors.text.muted, marginTop: 0, marginBottom: 16 }}>
        Core and Refinements only control what is shown on the canvas. They never change the saved diagram or the
        Knowledge Graph.
      </p>

      <SectionLabel>Core</SectionLabel>
      {presentation.core ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            marginBottom: 10,
            background: colors.primary.lighter,
            border: `1px solid ${colors.primary.light}`,
            borderRadius: radii.md,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden>⭐</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: colors.primary.darker, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {presentation.core.label}
            </div>
            <div style={{ fontSize: 11, color: colors.primary.dark }}>{presentation.core.elementIds.length} element(s) · always visible</div>
          </div>
          <button
            onClick={handleClearCore}
            title="Clear core"
            style={{ ...iconButtonStyle, background: 'transparent', borderColor: colors.primary.light }}
          >
            ✕
          </button>
        </div>
      ) : (
        <EmptyState>No core defined yet. Select elements on the canvas, then set them as Core.</EmptyState>
      )}
      <button onClick={handleSetCoreFromSelection} style={{ ...getButtonStyle(), width: '100%', marginBottom: 18 }}>
        ⭐ Set Selection as Core
      </button>

      <SectionLabel>Refinements</SectionLabel>
      {presentation.refinements.length === 0 ? (
        <EmptyState>No refinements yet. Select elements and create one from the current selection.</EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {presentation.refinements.map((r) => (
            <RefinementRow
              key={r.id}
              refinement={r}
              onRename={() => handleRenameRefinement(r)}
              onToggle={() => handleToggleVisible(r.id)}
              onAddSelection={() => handleAddSelectionToRefinement(r.id)}
              onRemove={() => handleRemoveRefinement(r.id)}
            />
          ))}
        </div>
      )}
      <button onClick={handleCreateRefinement} style={{ ...getButtonStyle(), width: '100%', marginBottom: 18 }}>
        ➕ New Refinement from Selection
      </button>

      <SectionLabel>Actions</SectionLabel>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleShowAll} style={{ ...getEmphasisButtonStyle('info'), flex: 1 }}>
          Show All
        </button>
        <button onClick={handleHideAll} style={{ ...getEmphasisButtonStyle('neutral'), flex: 1 }}>
          Core Only
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: colors.text.muted,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        marginBottom: 10,
        fontSize: 11.5,
        lineHeight: 1.4,
        color: colors.text.muted,
        background: colors.surface.sunken,
        border: `1px dashed ${colors.surface.borderStrong}`,
        borderRadius: radii.md,
      }}
    >
      {children}
    </div>
  );
}

function RefinementRow({
  refinement,
  onRename,
  onToggle,
  onAddSelection,
  onRemove,
}: {
  refinement: PresentationRefinement;
  onRename: () => void;
  onToggle: () => void;
  onAddSelection: () => void;
  onRemove: () => void;
}) {
  const hidden = !refinement.visible;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        background: hidden ? colors.surface.sunken : colors.surface.panel,
        border: `1px solid ${colors.surface.border}`,
        borderLeft: `3px solid ${hidden ? colors.surface.borderStrong : colors.semantic.success.main}`,
        borderRadius: radii.md,
        opacity: hidden ? 0.75 : 1,
        transition: 'opacity 0.15s ease, background 0.15s ease',
      }}
    >
      <input
        type="checkbox"
        checked={refinement.visible}
        onChange={onToggle}
        title={refinement.visible ? 'Visible - click to hide' : 'Hidden - click to show'}
        style={{ width: 15, height: 15, accentColor: colors.primary.main, cursor: 'pointer', flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 12.5,
            color: colors.text.primary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {refinement.label}
        </div>
        <div style={{ fontSize: 10.5, color: colors.text.muted }}>
          {refinement.elementIds.length} element(s) · {hidden ? 'Hidden' : 'Visible'}
        </div>
      </div>
      <button
        onClick={onRename}
        title="Rename refinement"
        aria-label={`Rename refinement ${refinement.label}`}
        style={iconButtonStyle}
      >
        ✎
      </button>
      <button onClick={onAddSelection} title="Add current selection to this refinement" style={iconButtonStyle}>
        ➕
      </button>
      <button
        onClick={onRemove}
        title="Remove refinement and its exclusive elements"
        style={{ ...iconButtonStyle, color: colors.semantic.danger.main, borderColor: colors.semantic.danger.main }}
      >
        🗑️
      </button>
    </div>
  );
}

import type { CSSProperties } from 'react';
import { colors, radii, shadows, fontFamily } from './theme';

// Small pill button used throughout the toolbar (Open, Save, Undo, Redo, ...)
export const simpleButtonStyle: CSSProperties = {
  padding: '6px 10px',
  margin: '2px',
  border: `1px solid ${colors.surface.border}`,
  backgroundColor: colors.surface.panel,
  borderRadius: radii.pill,
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 600,
  color: colors.text.primary,
  height: '30px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
  boxShadow: shadows.sm,
};

// Wraps a related cluster of toolbar buttons in a soft pill container
export const toolbarGroupStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '3px',
  border: `1px solid ${colors.surface.borderStrong}`,
  borderRadius: radii.pill,
  background: colors.surface.sunken,
  boxShadow: shadows.sm,
};

// Small square icon button (alignment / distribute / organize tools)
export const iconButtonStyle: CSSProperties = {
  padding: '4px',
  border: `1px solid ${colors.surface.border}`,
  backgroundColor: colors.surface.panel,
  borderRadius: radii.sm,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '28px',
  minWidth: '28px',
  color: colors.text.secondary,
  margin: '1px',
};

type Emphasis = 'neutral' | 'info' | 'success' | 'danger';

const emphasisColor = (emphasis: Emphasis) => {
  switch (emphasis) {
    case 'info': return colors.semantic.info;
    case 'success': return colors.semantic.success;
    case 'danger': return colors.semantic.danger;
    default: return colors.semantic.neutralDark;
  }
};

// Toolbar action button that carries semantic meaning (e.g. Create KG = danger/highlight,
// KG Viewer = info, Validate = neutral-dark) instead of an arbitrary one-off color.
export function getEmphasisButtonStyle(emphasis: Emphasis): CSSProperties {
  const c = emphasisColor(emphasis);
  return {
    ...simpleButtonStyle,
    backgroundColor: c.main,
    color: c.contrastText,
    borderColor: c.main,
  };
}

export function getToolbarButtonStyle(options?: {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  fontWeight?: number | string;
  fontSize?: number | string;
  padding?: string;
  margin?: string;
  borderRadius?: string | number;
  height?: string | number;
}): CSSProperties {
  return {
    padding: options?.padding ?? '4px 8px',
    margin: options?.margin ?? '2px',
    border: `1px solid ${options?.borderColor ?? colors.primary.dark}`,
    backgroundColor: options?.backgroundColor ?? colors.surface.sunken,
    borderRadius: options?.borderRadius ?? radii.sm,
    cursor: 'pointer',
    fontSize: options?.fontSize ?? '13px',
    fontWeight: options?.fontWeight ?? 'normal',
    color: options?.color ?? colors.text.secondary,
    height: options?.height ?? '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

// Sidebar action button (RightSidebar quick actions)
export function getButtonStyle(options?: {
  background?: string;
  color?: string;
  fontWeight?: number | string;
  textAlign?: string;
  marginBottom?: number;
}): CSSProperties {
  return {
    padding: '6px',
    background: options?.background ?? colors.primary.main,
    color: options?.color ?? colors.text.onPrimary,
    borderRadius: radii.md,
    border: '1px solid #eee',
    fontWeight: options?.fontWeight ?? 600,
    textAlign: (options?.textAlign as any) ?? ('center' as any),
    marginBottom: options?.marginBottom ?? 0,
    fontFamily,
    fontSize: 14,
    cursor: 'pointer',
  };
}

// Sidebar navigation menu button (RightSidebar section tabs)
export function getMenuButtonStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '12px 12px',
    background: active
      ? `linear-gradient(135deg, ${colors.semantic.neutralDark.dark} 0%, ${colors.semantic.neutralDark.main} 100%)`
      : '#f8fafc',
    color: active ? '#f8fafc' : '#0f172a',
    borderRadius: radii.xl,
    border: active ? `1px solid ${colors.semantic.neutralDark.main}` : '1px solid #e5e7eb',
    fontWeight: 600,
    fontFamily,
    fontSize: 13,
    cursor: 'pointer',
    boxShadow: active ? shadows.lg : shadows.sm,
    transition: 'all 0.2s ease',
  };
}

// LeftSidebar collapsible section header (Shapes / category / Patterns rows)
export function getSectionHeaderStyle(collapsed: boolean, level: 'top' | 'category' | 'sub' = 'top'): CSSProperties {
  const background = level === 'top'
    ? (collapsed ? colors.primary.light : colors.primary.main)
    : level === 'category'
      ? (collapsed ? colors.primary.dark : colors.primary.light)
      : (collapsed ? '#85a2d8' : '#9abbf8');
  return {
    padding: level === 'top' ? '10px 12px' : '10px 12px',
    borderRadius: radii.lg,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: level === 'sub' ? '12px' : '13px',
    fontWeight: level === 'top' ? 700 : 600,
    letterSpacing: level === 'top' ? '0.4px' : undefined,
    textTransform: level === 'top' ? 'uppercase' : undefined,
    transition: 'all 0.2s ease',
    userSelect: 'none',
    background,
    color: colors.text.onPrimary,
    border: `1px solid ${level === 'top' ? colors.primary.darker : '#bbdefb'}`,
  };
}

import type { MouseEvent } from 'react';

export interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
  onCopyEmail: () => void;
}

export default function AboutDialog({ open, onClose, onCopyEmail }: AboutDialogProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '30px',
          maxWidth: '700px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '25px',
            paddingBottom: '15px',
            borderBottom: '2px solid #e3f2fd'
          }}
        >
          <h2 style={{
            margin: 0,
            color: '#1976d2',
            fontSize: '24px',
            fontWeight: '600'
          }}>
            About Tool4Boxology
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#666',
              padding: '5px',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f0f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ lineHeight: '1.6', color: '#333' }}>
          {/* Development Status Notice */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              backgroundColor: '#fff3cd',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid #ffeaa7',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
              <div>
                <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#856404' }}>
                  Active Development Notice
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>
                  This interface is under <strong>active development</strong>. New features and visual enhancements are being added frequently.
                  Check our GitHub repository regularly for the latest updates and improvements.
                </p>
              </div>
            </div>
          </div>

          {/* Main Description */}
          <div style={{ marginBottom: '25px' }}>
            <div style={{
              backgroundColor: '#e3f2fd',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #bbdefb'
            }}>
              <h3 style={{
                margin: '0 0 15px 0',
                color: '#1976d2',
                fontSize: '18px'
              }}>
                🤖 Hybrid AI System Design Tool
              </h3>
              <p style={{ margin: 0, fontSize: '16px' }}>
                This web application assists you in creating <strong>Hybrid AI systems</strong> and
                validates them against established design patterns. Design, visualize, and validate
                your AI architecture with confidence.
              </p>
            </div>
          </div>

          {/* GitHub Section - Updated with development notice */}
          <div style={{ marginBottom: '25px' }}>
            <h4 style={{
              color: '#1976d2',
              margin: '0 0 10px 0',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              📚 Documentation & Latest Updates
            </h4>
            <p style={{ margin: '0 0 10px 0' }}>
              For detailed documentation, installation guides, source code, and <strong>the latest updates</strong>:
            </p>
            <a
              href="https://github.com/SDM-TIB/Tool4Boxology.git"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                backgroundColor: '#333',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: '500',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#555';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#333';
              }}
            >
              🔗 Visit GitHub Repository
            </a>
            <div style={{
              marginTop: '8px',
              fontSize: '12px',
              color: '#666',
              fontStyle: 'italic'
            }}>
              💡 Tip: Star the repository to get notified about new releases!
            </div>
          </div>

          {/* Contact Section */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{
              color: '#1976d2',
              margin: '0 0 15px 0',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              💬 Need Help or Have Suggestions?
            </h4>
            <p style={{ margin: '0 0 15px 0' }}>
              If you need assistance or have recommendations for improvements,
              feel free to reach out:
            </p>

            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid #dee2e6',
              display: 'flex',
              alignItems: 'center',
              gap: '15px'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '14px',
                  color: '#666',
                  marginBottom: '5px'
                }}>
                  Contact Email:
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#333',
                  fontFamily: 'Monaco, Consolas, monospace'
                }}>
                  mahsa.forghani.tehrani@stud.uni-hannover.de
                </div>
              </div>
              <button
                onClick={onCopyEmail}
                style={{
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = '#45a049';
                }}
                onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = '#4caf50';
                }}
                title="Copy email to clipboard"
              >
                📋 Copy Email
              </button>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            borderTop: '1px solid #eee',
            paddingTop: '20px',
            textAlign: 'center',
            color: '#666',
            fontSize: '12px'
          }}>
            <p style={{ margin: 0 }}>
              Developed at TIB - SDM GROUP • Powered by GoJS
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

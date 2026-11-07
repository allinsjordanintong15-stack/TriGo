import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import logo from '../assets/logo.png';
import {
  legalVersionLine,
  PRIVACY_CONTACT,
  PRIVACY_NOTICE,
  TERMS,
  type LegalDocument,
} from '../lib/legal';

const DOCUMENTS: Record<LegalDocument['id'], LegalDocument> = {
  'privacy-notice': PRIVACY_NOTICE,
  terms: TERMS,
};

/**
 * Public /privacy and /terms on the hosting domain (no sign-in): the same text the app
 * shows, from the shared legal module. Section ids are anchors (e.g. /privacy#deletion).
 */
export function LegalPage({ document: documentId }: { document: LegalDocument['id'] }) {
  const legalDocument = DOCUMENTS[documentId];
  const other = documentId === 'terms' ? PRIVACY_NOTICE : TERMS;

  useEffect(() => {
    const previous = window.document.title;
    window.document.title = `${legalDocument.title}`;
    return () => {
      window.document.title = previous;
    };
  }, [legalDocument.title]);

  // Scroll to #section after the page renders (direct links from the app or elsewhere).
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) window.document.getElementById(id)?.scrollIntoView();
  }, [documentId]);

  return (
    <div className="legal-page">
      <header className="legal-header">
        <img src={logo} alt="" width={40} height={40} />
        <span className="legal-brand">TriGo</span>
      </header>

      <main className="legal-content">
        <article className="card legal-article">
          <h1>{legalDocument.title}</h1>
          <p className="muted">{legalVersionLine()}</p>

          <section className="legal-summary" aria-label="In short">
            <h2>In short</h2>
            <ul>
              {legalDocument.summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <nav className="legal-toc" aria-label="Contents">
            <h2>Contents</h2>
            <ol>
              {legalDocument.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.heading.replace(/^\d+\.\s*/, '')}</a>
                </li>
              ))}
            </ol>
          </nav>

          {legalDocument.sections.map((section) => (
            <section key={section.id} id={section.id} className="legal-section">
              <h2>{section.heading}</h2>
              {section.blocks.map((block, index) =>
                block.kind === 'paragraph' ? (
                  <p key={index}>{block.text}</p>
                ) : (
                  <ul key={index}>
                    {block.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}
        </article>

        <footer className="legal-footer">
          <p>
            Questions about your data: {PRIVACY_CONTACT.name},{' '}
            <a href={`mailto:${PRIVACY_CONTACT.email}`}>{PRIVACY_CONTACT.email}</a>
          </p>
          <p>
            <Link to={other.id === 'terms' ? '/terms' : '/privacy'}>Read the {other.title.replace(/^TriGo /, '')}</Link>
          </p>
        </footer>
      </main>
    </div>
  );
}

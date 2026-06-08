// Public Terms-of-Use page (/legal/terms). Reachable without auth.
import { TERMS_DOC } from '../../content/legal/legalDocs';
import LegalDocPage from './LegalDocPage';

export default function TermsPage() {
  return <LegalDocPage doc={TERMS_DOC} />;
}

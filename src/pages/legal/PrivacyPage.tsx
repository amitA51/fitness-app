// Public Privacy-Policy page (/legal/privacy). Reachable without auth.
import { PRIVACY_DOC } from '../../content/legal/legalDocs';
import LegalDocPage from './LegalDocPage';

export default function PrivacyPage() {
  return <LegalDocPage doc={PRIVACY_DOC} />;
}

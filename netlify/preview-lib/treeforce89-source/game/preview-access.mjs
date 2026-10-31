import {previewRequestAllowed} from '../../treeforce89-database.mjs';
export const PREVIEW_BRANCH='feature/treeforce89-play-integration';
// Replace only the source site's deployment adapter; retain strict same-origin POST checks.
export const previewAccessAllowed=previewRequestAllowed;

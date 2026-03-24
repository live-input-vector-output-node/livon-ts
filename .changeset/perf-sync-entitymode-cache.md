---
'@livon/sync': patch
---
Improve `entityMode` many-read performance by using an adaptive subview strategy:
small memberships keep the direct fast path, while large memberships reuse stable references when entity entries are unchanged.

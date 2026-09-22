# Netlify support request: preserve existing function packages during frontend release

Site: tree-token.xyz (site ID aa62f324-b880-47d6-85b8-4ba0700ff5bf)

Our published deployment is locked at 6aad931f45a27f392303e229. We need to publish a reviewed frontend-only update while retaining the exact 35 deployed functions and five schedules.

The September 18 release succeeded with package reuse. On September 22, the same functions hash map, functions_config, function_schedules, and branch (kelpie-v3-release-safe) were submitted, but Netlify returned all 35 hashes in required_functions. Diagnostic 6ab20f1034916c14d00e600f was canceled without uploading functions or promoting it. A second approved diagnostic in production context (branch main), 6ab216210f88f76636b95573, also requested all 35 packages and was canceled.

Please investigate why the existing packages cannot be reused and provide a supported way to retain their exact deployed identities and configuration in a new frontend release. If reuse cannot be restored, can you securely export or recover the exact five packages listed below from the published deployment? Please do not unlock, rebuild, or replace the live deployment.

| Function | Current deployed SHA-256 |
| --- | --- |
| tree-knowledge-trial | a56b56f53359c5851a63054727e0837e66ac348254ab1eb4cb8cb2dda70b61e6 |
| tree-knowledge-trial-admin | dc75c3f15ef8b987d4e5e2f5e52a7cc63b49370fd70d0f05b0038402d0f1df2e |
| tree-knowledge-trial-resolver | cea6704c22e402c27a2d4c688612b360af61b9b067aaec55413bc8f5a20ad17f |
| tree-knowledge-trial-rotation-on-deploy | 4e5265469d8531285e844d6fc263fd94d50d13c750fb15448c70cfd19be833f7 |
| tree-knowledge-trial-rotation-scheduled | 844c238d00d934fabcdcd790441eb8c9809a234072b949f871e671675311b53e |

We have exact local ZIPs for the other 30 functions. We checked 219 ZIP archives in the project workspaces, primary repository, and deployment cache; the five listed packages were not found. Targeted temporary/download searches and reachable Git history did not recover them. Two unrelated temporary directories were unreadable. GitHub lists 11 artifacts; none is a deployment-function package archive. We have not established the cause of the reuse failure.

A successful deployment reference is 6aad931f45a27f392303e229; failed requests are identified above. No backend packages were uploaded during these attempts, and the published deploy remains locked.

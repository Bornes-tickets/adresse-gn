# Adresse GN — Documentation complète de migration R8

**Date de clôture : 23 octobre 2026**
**Dépôt : `Bornes-tickets/adresse-gn`**
**Branche : `feature/maps-road-data`**
**Commit final : `4a11531edfb655dc8851d7ab3289e346d1b7c77a`**

> Ce document consolide les jalons vérifiés disponibles depuis le début de la migration, puis détaille exhaustivement la séquence R8 jusqu’au commit et au push final. Les anciennes phases pour lesquelles tous les transcriptions/scripts bruts ne sont pas présents dans le dossier courant sont signalées comme jalons historiques plutôt que reconstruites artificiellement.

## 1. Résumé exécutif
| Élément | Valeur |
| --- | --- |
| Projet | Adresse GN — migration de l’application legacy TanStack/Supabase vers une cible Next.js + Django + PostgreSQL/Supabase Auth/Storage. |
| Dépôt | Bornes-tickets/adresse-gn |
| Branche de clôture | feature/maps-road-data |
| Commit final | 4a11531edfb655dc8851d7ab3289e346d1b7c77a |
| Message | feat: complete R8 global migration and role portals |
| Push | Fast-forward vérifié vers GitHub, sans --force et sans tags. |
| État distant | LOCAL HEAD = REMOTE HEAD = 4a11531edfb655dc8851d7ab3289e346d1b7c77a ; ahead=0 ; behind=0. |
| Volume final | 147 fichiers ; 37 569 insertions ; 82 suppressions. |
| Validation finale | 133 fichiers Python compilés, Django check PASS, ESLint 0 erreur/19 warnings, TypeScript PASS, Next.js production build PASS (72 pages), git diff --check PASS. |

## 2. Architecture cible et principes
- Frontend cible : Next.js (App Router) + TypeScript.
- Backend cible : Django/DRF.
- Identité : Supabase Auth ; rôle technique JWT séparé du rôle métier stocké dans `public.profiles`.
- Données : PostgreSQL/Supabase ; Storage conservé pour les flux documentaires autorisés.
- Principe d’autorité : lorsqu’un workflow Django V1 existe déjà, il prime sur une mutation historique legacy.
- Principe de sécurité : audits read-only par défaut ; aucune mutation DB/Auth/Storage/activité métier sans autorisation et justification explicites.
- Principe Git : staging, commit et push séparés, contrôlés par manifeste et autorisation explicite.

## 3. Historique amont avant R8
- Migration progressive initiale sur la branche migration/nextjs-django avec découpage en phases contrôlées et validation commit par commit.
- Phase 13.5-R5A : mutations propriétaire restantes E2E (suspend, moving, profile, deactivate) avec services simulés et sans commit pendant l’audit.
- Phase 14C7E-R6I : normalisation / migration globale du référentiel territorial, recalcul de mapping par préfecture et contrôles sur 378 communes en dry-run.
- Phase 16C2-E1-R2 : tracking public E2E et contrat pending → active, sans storage/provider externe.
- Audit et durcissement du workflow de préallocation physique avant la clôture R8 globale.

## 4. Matrice R8 — état final
| Phase | État final | Périmètre |
| --- | --- | --- |
| G1 — Global Role Foundation | CLOSED / PASS | Socle de rôles, permissions, ROLE_HOME, SPACE_ROLES, shells et guards par espace. |
| G2 — Content Parity Batch | CLOSED / PASS | Ressources read-only mutualisées, 28 ressources SQL, ResourcePage générique, redirections canoniques. |
| G3 — Action / Mutation Parity | CLOSED / PASS WITH DOCUMENTED POLICY DEFERMENTS | Autorité métier, actions internes/externes, installation physique, claims, réactivation, upload documentaire ; mutations risquées non recopiées. |
| G4 — Automated + Browser Validation | CLOSED / PASS WITH DOCUMENTED CREDENTIAL EXCEPTION | 79 routes auditées, 53 routes requises sans manque, tests de rôles/routes/API et smoke browser limité. |

### 4.1 Routage par rôle
| Rôle | Home | Objet |
| --- | --- | --- |
| user | /mon-compte | Espace propriétaire/client |
| agent | /agent → /agent/tasks | Portail terrain |
| support | /support | Support et signalements |
| sales | /sales | Commercial |
| ops | /ops | Opérations / stock / lots |
| supervisor | /supervisor | Supervision / QC / planning |
| admin / super_admin | /admin | Administration globale |

### 4.2 Autorités métier conservées
| Domaine | Autorité | Décision |
| --- | --- | --- |
| Réclamations | backoffice.claims.decide_claim | Autorité actuelle conservée. |
| Réactivation compte | backoffice.accounts.reactivate_account | Autorité actuelle conservée. |
| Workflow installation physique | physical_installation_workflow | Assign/reassign/schedule/field-complete/validate/publish non contournés. |
| Field complete | physical_installations.record_physical_installation | Enregistrement terrain autoritatif. |
| Désinstallation | backoffice.installations.register_installation_uninstall | Workflow Django existant conservé. |
| Balises / numérotation | V1 actuelle | Génération legacy brute non restaurée. |
| Paiement manuel Sales | DEFERRED_BY_POLICY | Pas d’action/dispatch confirmé dans le catalogue Sales. |
| Facturation récurrente | DEFERRED_BY_POLICY | Non exposée plutôt que recréée hors autorité. |

## 5. G1 — Global Role Foundation
- Mise en place du socle global de rôles et permissions.
- Normalisation de `SPACE_ROLES`, `ROLE_HOME` et des shells/guards partagés.
- Routage post-login vers les espaces user, agent, support, sales, ops, supervisor et admin/super_admin.
- Restrictions par capacité : admin pour admin/super_admin ; supervisor pour supervisor/admin/super_admin ; sales, ops et support selon la même logique d’escalade.
- Validation statique et compilation frontend/backend avant clôture G1.

## 6. G2 — Content Parity Batch
- Migration des contenus read-only du legacy vers des ressources Django mutualisées.
- Mise en place de 28 ressources SQL réutilisables.
- Création d’un `ResourcePage` générique côté Next.js pour éviter la duplication de pages CRUD de consultation.
- Conservation de routes canoniques avec redirections plutôt que duplication de vues métier historiques.
- Validation du contrat de ressources et des routes avant passage à G3.

## 7. G3 — Action / Mutation Parity
- D0 : audit d’autorité de mutation avant toute reprise des actions legacy.
- P1 : actions internes autorisées et câblage contrôlé.
- P2 : actions externes et préflight runtime, en conservant les limites Auth/Storage/provider.
- D1/R3/D3 : audit de clôture ciblé, correctif upload, requalification Sales/facturation, puis réaudit final.
- Résultat D3 : 9 points CLOSED, 6 DEFERRED_BY_POLICY, 0 blocker.

### 7.1 Correctifs et décisions G3
| Correctif | Fichier | Décision |
| --- | --- | --- |
| JWT clock skew | apps/api/config/authentication.py | Ajout de leeway=10 dans la validation JWT pour absorber un décalage local mesuré de quelques secondes, sans désactiver signature, issuer, audience, exp/iat. |
| Rôle métier / rôle technique | apps/api/config/auth_views.py | Le rôle métier est lu depuis public.profiles.role ; le rôle JWT technique reste exposé séparément sous auth_role. |
| Upload documentaire | apps/api/backoffice/action_external.py | MAX_DOC_BYTES ramené de 10 MiB à 8 MiB et WebP ajouté aux MIME autorisés : JPEG, PNG, WebP, PDF. |

### 7.2 Deferments documentés
- Legacy beacon bulk generation — non restaurée pour ne pas contourner la numérotation V1.
- Account deactivate/reactivate runtime — runtime sensible, conservé comme deferment documenté.
- External create user/agent runtime — runtime externe/Auth sensible, non exécuté pendant les audits statiques.
- Generated document upload runtime — comportement externe/Storage non exécuté dans l’audit de clôture.
- Sales manual payment confirm/reject — deferment de policy après audit précis, absence d’action/dispatch autorisé.
- Recurring billing — deferment de policy, fonctionnalité non recréée artificiellement.

### 7.3 Requêtes SQL d’audit utilisées
#### Existence de table — audit read-only
```sql
SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = %s
      AND table_name = %s
);
```
#### Colonnes — audit read-only
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = %s
  AND table_name = %s;
```
#### Triggers custom auth.users
```sql
SELECT
    tg.tgname,
    pn.nspname,
    p.proname,
    pg_get_functiondef(p.oid)
FROM pg_trigger tg
JOIN pg_class cls ON cls.oid = tg.tgrelid
JOIN pg_namespace ns ON ns.oid = cls.relnamespace
JOIN pg_proc p ON p.oid = tg.tgfoid
JOIN pg_namespace pn ON pn.oid = p.pronamespace
WHERE ns.nspname = 'auth'
  AND cls.relname = 'users'
  AND NOT tg.tgisinternal
ORDER BY tg.tgname;
```
#### Profil métier — auth /me
```sql
SELECT role, full_name
FROM public.profiles
WHERE id = %s
LIMIT 1;
```

## 8. G4 — Validation automatisée et navigateur
| Contrôle | Périmètre | Résultat |
| --- | --- | --- |
| G4-A1 | 79 routes auditées | 53 routes requises, missing=0 ; rôles, homes, layouts, URLs Django, 28 ressources et action catalog contrôlés. |
| Browser smoke | 6 espaces métier + super_admin | agent/support/sales/ops/supervisor/super_admin : landing positif et forbidden négatif validés. |
| Exception user | amisow@gmail.com | Mot de passe indisponible / Supabase 400 invalid credentials. Documenté comme exception de credential, pas comme défaut applicatif. |

- L’exception du compte user `amisow@gmail.com` a été classée comme indisponibilité de credential : elle n’a pas été utilisée pour déclarer un défaut applicatif.
- Les espaces agent, support, sales, ops, supervisor et super_admin ont passé les vérifications de landing et d’interdiction de routes non autorisées.

## 9. Correctifs finaux avant freeze
| Sujet | Fichier(s) | Correction |
| --- | --- | --- |
| JWT clock skew | apps/api/config/authentication.py | Ajout de leeway=10 dans la validation JWT pour absorber un décalage local mesuré de quelques secondes, sans désactiver signature, issuer, audience, exp/iat. |
| Rôle métier / rôle technique | apps/api/config/auth_views.py | Le rôle métier est lu depuis public.profiles.role ; le rôle JWT technique reste exposé séparément sous auth_role. |
| Upload documentaire | apps/api/backoffice/action_external.py | MAX_DOC_BYTES ramené de 10 MiB à 8 MiB et WebP ajouté aux MIME autorisés : JPEG, PNG, WebP, PDF. |
| BOM UTF-8 | settings_e2e.py + 2 tests | Suppression de U+FEFF en tête de trois fichiers qui bloquaient le compile global. |
| JSX | agent-install-page.tsx | Correction de trois apostrophes non échappées détectées par react/no-unescaped-entities. |
| React effect | agent-history-page.tsx | Appel loadHistory décalé via window.setTimeout(..., 0) pour éviter setState synchrone depuis useEffect selon la règle React Hooks. |
| Whitespace | 4 fichiers Python | Suppression d’une ligne blanche finale supplémentaire avant commit afin de faire passer git diff --cached --check. |

### 9.1 Extraits de code représentatifs
#### JWT — tolérance d’horloge bornée
```text
issuer=(
    settings.SUPABASE_JWT_ISSUER
),
# Signature / iss / aud / exp / iat restent actifs.
leeway=10,
options={...}
```
#### Auth /me — rôle métier autoritatif
```text
with connection.cursor() as cursor:
    cursor.execute(
        """
        SELECT role, full_name
        FROM public.profiles
        WHERE id = %s
        LIMIT 1
        """,
        [request.user.id],
    )
    row = cursor.fetchone()

business_role, full_name = row

# Réponse
"role": business_role,
"full_name": full_name,
"auth_role": request.user.role
```
#### Upload documentaire
```text
MAX_DOC_BYTES = 8 * 1024 * 1024

ALLOWED_DOC_MIME = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}
```
#### React history — correction de l’effect
```text
useEffect(() => {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(() => {
    void loadHistory(controller.signal);
  }, 0);

  return () => {
    window.clearTimeout(timeoutId);
    controller.abort();
  };
}, [loadHistory]);
```

## 10. Freeze final et qualité
| Contrôle | Mesure | Résultat |
| --- | --- | --- |
| Python | 133 fichiers | Compilation syntaxique globale = 0 failure après nettoyage BOM. |
| Django | manage.py check | 0 issue. |
| ESLint | apps/web | 0 erreur ; 19 warnings non bloquants. |
| TypeScript | tsc --noEmit | PASS via node_modules/.bin/tsc.cmd racine monorepo. |
| Next build | Next.js 16.3.4 / Turbopack | Build production PASS ; 72 pages générées. |
| Git quality | git diff --check / --cached --check | PASS après réparation des 4 EOF. |

## 11. Séquence Git de clôture
1. **F6 — Commit Manifest Audit** : 147 candidats INCLUDE, 51 backups EXCLUDE, 0 forbidden, 0 review, `git diff --check = PASS`.
2. **F7 — Controlled Staging** : staging exact des 147 fichiers ; aucun backup staged.
3. **F7-R1 — Whitespace Repair** : correction de 4 `new blank line at EOF`, restaging des 4 fichiers et `git diff --cached --check = PASS`.
4. **F8 — Controlled Local Commit** : commit local `4a11531edfb655dc8851d7ab3289e346d1b7c77a`, parent `f598cf02a8d45bc12e4fa92353087d033348d92e`, manifeste exact des 147 fichiers.
5. **F9 — Remote Preflight** : remote ancestor du local, local ahead=11, behind=0, relation fast-forward validée.
6. **F10 — Controlled GitHub Push** : push exact du SHA vers `refs/heads/feature/maps-road-data`, sans force et sans tag.
7. **Post-push** : LOCAL HEAD = REMOTE HEAD = `4a11531edfb655dc8851d7ab3289e346d1b7c77a`, ahead=0, behind=0.

## 12. Artefacts de migration et empreintes
| Artefact | Taille (octets) | SHA256 |
| --- | --- | --- |
| R8_GLOBAL_G1_APPLY_PS51_FINAL.ps1 | 60669 | 55FCEEB18FD7B33D71D1B94DE065C9D33686D83AACB394E5CDB7B4078D873BE3 |
| R8_GLOBAL_G2_CONTENT_PARITY_PS51_CORRIGE.ps1 | 83891 | 62683961F327058811E968D15528E286E9C0433E376720CA4F36B10CE3125583 |
| R8_GLOBAL_G3_D0_ACTION_AUTHORITY_AUDIT_PS51.ps1 | 16290 | 19356F58F2F7194679C202476EB4386A3000F629666D460927B6FC46499A2BB1 |
| R8_GLOBAL_G3_FINAL_D1_TARGETED_CLOSURE_AUDIT.py | 40492 | B68A39378A736D17C8AA20163F3DFD3B16EA2D57960D3BB482F2F0C37C492728 |
| R8_GLOBAL_G3_FINAL_R3_UPLOAD_FIX_D2_SALES_AUDIT.py | 20412 | 34A39AC75A8E59B3B9EFE3F1B1B1CE042BB87B28F39B0E07D4A05A0C217EE8C6 |
| R8_GLOBAL_G3_FINAL_D3_CLOSURE_REAUDIT.py | 27140 | C9C96EFD962879C97012933343192D06E628A6EA56425461B8B9D49D6C7D206B |
| R8_GLOBAL_G4_A1_R2_ARCHITECTURE_AWARE_AUDIT.py | 32848 | 0AD945385FC0EA132BDB5AE4F99627F3ED7106AF35A39E0ACEB2E5656D28413A |
| R8_GLOBAL_G4_BROWSER_R1_JWT_CLOCK_SKEW_FIX.py | 6351 | 9070C13B207E9146E426BD25CEC61063DFD06BBA0B715288DF74C2D407227A5B |
| R8_GLOBAL_G4_BROWSER_R2_AUTH_ME_BUSINESS_ROLE_FIX.py | 10260 | 5AB7EF26D9466DCFB2371028BEEC77414723784734276C428779A624B4874667 |
| R8_GLOBAL_FINAL_F1_R2_PRECOMMIT_FREEZE_AUDIT.py | 22150 | B4834B0DB396B2BCC31BE979EE796915916A36DD3C740F31589E896D8EBD60D4 |
| R8_GLOBAL_FINAL_R4_BOM_JSX_FIX_HOOK_DIAG.py | 12853 | 31F446CA3358786C0AA6EFE33D3DC526C15676AD9CFB1D9DBF0846B863751195 |
| R8_GLOBAL_FINAL_R5.py | 13054 | B93E1B9AFD7A773E4FB4968B65DCD021C97EA6CC9FA8C11E2D692A1CA2311AC3 |
| R8_GLOBAL_FINAL_F6_COMMIT_MANIFEST_AUDIT.py | 10700 | BA1239175F49CCD4CACF146722C2390B7C9507C8F66406560FADFDAB9984585B |
| R8_GLOBAL_FINAL_F7_CONTROLLED_STAGING.py | 15420 | A721C9F3137049A8C603990668B02B6378331637B578EA32CBDF1CA3C6DAF23D |
| R8_GLOBAL_FINAL_F7_R1_WHITESPACE_REPAIR.py | 12391 | 82771ADFC93CD4B8418F3F84ABD5CB9518C8CF2F962AC6728DA6235C2E89427D |
| R8_GLOBAL_FINAL_F8_CONTROLLED_LOCAL_COMMIT.py | 16031 | 44EF4DD0702FA09981617B8554D2E35E94AC2C1E5CAA76303B40CDCCE4E6074B |
| R8_GLOBAL_FINAL_F9_REMOTE_PREFLIGHT.py | 14347 | FB59EBB1CADB8F181A95E79DC9A3E9614A6394A55CFDB8FE71C0DDA4AD6585E7 |
| R8_GLOBAL_FINAL_F10_CONTROLLED_GITHUB_PUSH.py | 20283 | D147590A0ACB536B9741F6B5B1E0132A0234B8FCD4D1ECC6E11AEC727233BE01 |
| R8_GLOBAL_MIGRATION_MATRIX.md | 8367 | 76FC201EB5E39B9C636FD47C749C00A324A02968CD9AE007F1DE93DDFB051622 |
| R8_GLOBAL_MIGRATION_MATRIX.csv | 7181 | A6414816A6FB8F549173B4B9DDA9E88DB376F4F7C528C7A24FA134AFEB258272 |
| AdresseGN-R8-GLOBAL-MIGRATION-20261022-234436.zip | 806550 | 46F095D78A38E528B1E53EDC9B3E79527D2951C4A9265734C807307939618E5D |
| AdresseGN-R8-GLOBAL-SUPPLEMENT-20261022-235825.zip | 130393 | F4BC8BE8E1D3E189DDE845D448F6F01AE12E8CC08496C0B2F404ACF0C4417392 |

## 13. Manifest exact des 147 fichiers du commit final
1. `apps/api/agent_installations/__init__.py`
2. `apps/api/agent_installations/services.py`
3. `apps/api/agent_portal/__init__.py`
4. `apps/api/agent_portal/permissions.py`
5. `apps/api/agent_portal/serializers.py`
6. `apps/api/agent_portal/services.py`
7. `apps/api/agent_portal/urls.py`
8. `apps/api/agent_portal/views.py`
9. `apps/api/backoffice/action_admin.py`
10. `apps/api/backoffice/action_catalog.py`
11. `apps/api/backoffice/action_cms.py`
12. `apps/api/backoffice/action_common.py`
13. `apps/api/backoffice/action_external.py`
14. `apps/api/backoffice/action_ops.py`
15. `apps/api/backoffice/action_supervisor.py`
16. `apps/api/backoffice/address_views.py`
17. `apps/api/backoffice/addresses.py`
18. `apps/api/backoffice/beacon_views.py`
19. `apps/api/backoffice/beacons.py`
20. `apps/api/backoffice/dashboard.py`
21. `apps/api/backoffice/export_payloads.py`
22. `apps/api/backoffice/external_supabase.py`
23. `apps/api/backoffice/global_action_views.py`
24. `apps/api/backoffice/global_actions.py`
25. `apps/api/backoffice/global_portal.py`
26. `apps/api/backoffice/global_resource_views.py`
27. `apps/api/backoffice/global_resources.py`
28. `apps/api/backoffice/global_views.py`
29. `apps/api/backoffice/permissions.py`
30. `apps/api/backoffice/physical_installation_workflow.py`
31. `apps/api/backoffice/physical_installations.py`
32. `apps/api/backoffice/urls.py`
33. `apps/api/backoffice/views.py`
34. `apps/api/checkout/services.py`
35. `apps/api/config/auth_views.py`
36. `apps/api/config/authentication.py`
37. `apps/api/config/settings_e2e.py`
38. `apps/api/config/urls.py`
39. `apps/api/entitlements.py`
40. `apps/api/payments/services.py`
41. `apps/api/tests/e2e/test_r13_physical_preallocation_e2e.py`
42. `apps/api/tests/test_agent_i3_complete_contract.py`
43. `apps/api/tests/test_agent_i3_complete_http_wiring.py`
44. `apps/api/tests/test_agent_i3_complete_service.py`
45. `apps/api/tests/test_agent_i3_gps_schema_v1.py`
46. `apps/api/tests/test_agent_i3_requirements.py`
47. `apps/api/tests/test_agent_portal_i1.py`
48. `apps/api/tests/test_agent_portal_i2a.py`
49. `apps/api/tests/test_checkout_order_create.py`
50. `apps/api/tests/test_payment_numbering_v1.py`
51. `apps/api/tests/test_payment_snapshot_authority.py`
52. `apps/api/tests/test_physical_installation_snapshot_authority.py`
53. `apps/api/tests/test_physical_installation_workflow.py`
54. `apps/api/tests/test_physical_workflow_snapshot_authority.py`
55. `apps/api/tests/test_r13_physical_preallocation.py`
56. `apps/web/next.config.ts`
57. `apps/web/package.json`
58. `apps/web/src/app/admin/abonnements/page.tsx`
59. `apps/web/src/app/admin/addresses/page.tsx`
60. `apps/web/src/app/admin/adresses/page.tsx`
61. `apps/web/src/app/admin/agents/page.tsx`
62. `apps/web/src/app/admin/analytics/page.tsx`
63. `apps/web/src/app/admin/audit/page.tsx`
64. `apps/web/src/app/admin/balises/page.tsx`
65. `apps/web/src/app/admin/beacons/page.tsx`
66. `apps/web/src/app/admin/claims/page.tsx`
67. `apps/web/src/app/admin/cms/blog/page.tsx`
68. `apps/web/src/app/admin/cms/faq/page.tsx`
69. `apps/web/src/app/admin/cms/page.tsx`
70. `apps/web/src/app/admin/cms/pages/page.tsx`
71. `apps/web/src/app/admin/cms/tarifs/page.tsx`
72. `apps/web/src/app/admin/cms/traductions/page.tsx`
73. `apps/web/src/app/admin/installations-attente/page.tsx`
74. `apps/web/src/app/admin/installations/[id]/page.tsx`
75. `apps/web/src/app/admin/installations/page.tsx`
76. `apps/web/src/app/admin/justificatifs/page.tsx`
77. `apps/web/src/app/admin/layout.tsx`
78. `apps/web/src/app/admin/lots/page.tsx`
79. `apps/web/src/app/admin/page.tsx`
80. `apps/web/src/app/admin/payments/page.tsx`
81. `apps/web/src/app/admin/reports/page.tsx`
82. `apps/web/src/app/admin/users/page.tsx`
83. `apps/web/src/app/admin/zones/page.tsx`
84. `apps/web/src/app/agent/history/page.tsx`
85. `apps/web/src/app/agent/login/page.tsx`
86. `apps/web/src/app/agent/page.tsx`
87. `apps/web/src/app/agent/profile/page.tsx`
88. `apps/web/src/app/agent/tasks/[pendingInstallationId]/install/page.tsx`
89. `apps/web/src/app/agent/tasks/page.tsx`
90. `apps/web/src/app/ops/balises/page.tsx`
91. `apps/web/src/app/ops/beacons/page.tsx`
92. `apps/web/src/app/ops/commandes-fournisseurs/page.tsx`
93. `apps/web/src/app/ops/exports/page.tsx`
94. `apps/web/src/app/ops/layout.tsx`
95. `apps/web/src/app/ops/lots/page.tsx`
96. `apps/web/src/app/ops/page.tsx`
97. `apps/web/src/app/ops/stock/page.tsx`
98. `apps/web/src/app/reset-password/page.tsx`
99. `apps/web/src/app/sales/abonnements/page.tsx`
100. `apps/web/src/app/sales/clients/page.tsx`
101. `apps/web/src/app/sales/commandes/page.tsx`
102. `apps/web/src/app/sales/installations/page.tsx`
103. `apps/web/src/app/sales/layout.tsx`
104. `apps/web/src/app/sales/offres/page.tsx`
105. `apps/web/src/app/sales/page.tsx`
106. `apps/web/src/app/supervisor/claims/page.tsx`
107. `apps/web/src/app/supervisor/consultations/page.tsx`
108. `apps/web/src/app/supervisor/installations/page.tsx`
109. `apps/web/src/app/supervisor/layout.tsx`
110. `apps/web/src/app/supervisor/page.tsx`
111. `apps/web/src/app/supervisor/planning/page.tsx`
112. `apps/web/src/app/supervisor/reclamations/page.tsx`
113. `apps/web/src/app/supervisor/report-installations/page.tsx`
114. `apps/web/src/app/supervisor/reports/page.tsx`
115. `apps/web/src/app/supervisor/signalements/page.tsx`
116. `apps/web/src/app/support/layout.tsx`
117. `apps/web/src/app/support/page.tsx`
118. `apps/web/src/app/support/signalements/page.tsx`
119. `apps/web/src/app/support/terrain-gps/page.tsx`
120. `apps/web/src/components/layout/site-shell.tsx`
121. `apps/web/src/features/agent/api.ts`
122. `apps/web/src/features/agent/components/agent-bottom-nav.tsx`
123. `apps/web/src/features/agent/components/agent-history-page.tsx`
124. `apps/web/src/features/agent/components/agent-install-page.tsx`
125. `apps/web/src/features/agent/components/agent-login-page.tsx`
126. `apps/web/src/features/agent/components/agent-profile-page.tsx`
127. `apps/web/src/features/agent/components/agent-tasks-page.tsx`
128. `apps/web/src/features/agent/components/install/agent-install-step-beacon.tsx`
129. `apps/web/src/features/agent/components/install/agent-install-step-gps.tsx`
130. `apps/web/src/features/agent/components/install/agent-install-step-indicator.tsx`
131. `apps/web/src/features/auth/components/login-page.tsx`
132. `apps/web/src/features/backoffice/api.ts`
133. `apps/web/src/features/backoffice/client-exports.ts`
134. `apps/web/src/features/backoffice/components/admin-addresses-page.tsx`
135. `apps/web/src/features/backoffice/components/admin-beacons-page.tsx`
136. `apps/web/src/features/backoffice/components/admin-dashboard-page.tsx`
137. `apps/web/src/features/backoffice/components/admin-shell.tsx`
138. `apps/web/src/features/backoffice/components/resource-actions.tsx`
139. `apps/web/src/features/backoffice/components/resource-page.tsx`
140. `apps/web/src/features/backoffice/components/role-dashboard-page.tsx`
141. `apps/web/src/features/backoffice/components/role-shell.tsx`
142. `apps/web/src/features/backoffice/components/support-field-gps-page.tsx`
143. `apps/web/src/features/owner/components/owner-shell.tsx`
144. `apps/web/src/lib/supabase/browser.ts`
145. `capacitor.config.ts`
146. `package-lock.json`
147. `supabase/migrations/20261021093500_agent_gps_measure_contract_v1.sql`

## 14. Sauvegardes locales exclues du commit (51)
1. `apps/api/agent_portal/services.py.r7d-backup`
2. `apps/api/agent_portal/urls.py.r7d2-backup`
3. `apps/api/agent_portal/views.py.r7d2-backup`
4. `apps/api/backoffice/action_catalog.py.r8global-g3p2-pre`
5. `apps/api/backoffice/action_common.py.r8global-g3p2-pre`
6. `apps/api/backoffice/global_action_views.py.r8global-g3p2-pre`
7. `apps/api/backoffice/global_actions.py.r8global-g3p2-pre`
8. `apps/api/backoffice/global_resources.py.r8global-g3p1-pre`
9. `apps/api/backoffice/permissions.py.r8a1p0-backup`
10. `apps/api/backoffice/permissions.py.r8a1p1-pre`
11. `apps/api/backoffice/urls.py.r8a1p1-pre`
12. `apps/api/backoffice/urls.py.r8a2p1-pre`
13. `apps/api/backoffice/urls.py.r8a3p1-pre`
14. `apps/api/backoffice/urls.py.r8global-g1-pre`
15. `apps/api/backoffice/urls.py.r8global-g2-pre`
16. `apps/api/backoffice/urls.py.r8global-g3p1-pre`
17. `apps/api/backoffice/views.py.r8a1p0-backup`
18. `apps/api/backoffice/views.py.r8a1p1-pre`
19. `apps/web/src/app/admin/balises/page.tsx.r8global-g3p1-pre`
20. `apps/web/src/app/ops/layout.tsx.r8global-g1-pre`
21. `apps/web/src/app/ops/page.tsx.r8global-g1-pre`
22. `apps/web/src/app/sales/layout.tsx.r8global-g1-pre`
23. `apps/web/src/app/sales/page.tsx.r8global-g1-pre`
24. `apps/web/src/app/supervisor/layout.tsx.r8global-g1-pre`
25. `apps/web/src/app/supervisor/page.tsx.r8global-g1-pre`
26. `apps/web/src/app/support/layout.tsx.r8global-g1-pre`
27. `apps/web/src/app/support/page.tsx.r8global-g1-pre`
28. `apps/web/src/components/layout/site-shell.tsx.r8a1p2-pre`
29. `apps/web/src/components/layout/site-shell.tsx.r8global-g1-pre`
30. `apps/web/src/features/agent/api.ts.r6b-backup`
31. `apps/web/src/features/agent/api.ts.r7d3-backup`
32. `apps/web/src/features/agent/components/agent-history-page.tsx.r7d3-history-backup`
33. `apps/web/src/features/agent/components/agent-profile-page.tsx.r7e-backup`
34. `apps/web/src/features/agent/components/agent-profile-page.tsx.r7e2-backup`
35. `apps/web/src/features/agent/components/agent-tasks-page.tsx.r7b-backup`
36. `apps/web/src/features/agent/components/agent-tasks-page.tsx.r7c-backup`
37. `apps/web/src/features/auth/components/login-page.tsx.r8global-g1-pre`
38. `apps/web/src/features/backoffice/api.ts.r8a1p2-pre`
39. `apps/web/src/features/backoffice/api.ts.r8a2p2-pre`
40. `apps/web/src/features/backoffice/api.ts.r8a3p2-pre`
41. `apps/web/src/features/backoffice/api.ts.r8global-g1-pre`
42. `apps/web/src/features/backoffice/api.ts.r8global-g2-pre`
43. `apps/web/src/features/backoffice/api.ts.r8global-g3p1-pre`
44. `apps/web/src/features/backoffice/api.ts.r8global-g3p2-pre`
45. `apps/web/src/features/backoffice/components/admin-addresses-page.tsx.r8global-g3p1-pre`
46. `apps/web/src/features/backoffice/components/admin-shell.tsx.r8a2p2-pre`
47. `apps/web/src/features/backoffice/components/admin-shell.tsx.r8a3p2-pre`
48. `apps/web/src/features/backoffice/components/admin-shell.tsx.r8global-g2-pre`
49. `apps/web/src/features/backoffice/components/resource-actions.tsx.r8global-g3p2-pre`
50. `apps/web/src/features/backoffice/components/resource-page.tsx.r8global-g3p1-pre`
51. `apps/web/src/features/owner/components/owner-shell.tsx.r8global-g1-pre`

## 15. Plan de nettoyage post-documentation
- Vérifier que le HEAD local et `origin/feature/maps-road-data` restent tous deux sur `4a11531edfb655dc8851d7ab3289e346d1b7c77a`.
- Vérifier `staged=0`, `tracked unstaged=0`, `untracked=51` et l’empreinte du manifeste des backups.
- Créer une archive ZIP hors dépôt contenant exactement les 51 backups, avec SHA256.
- Supprimer uniquement ces 51 chemins exacts.
- Vérifier ensuite `git status --short` vide, HEAD inchangé et remote inchangé.
- La documentation elle-même n’est pas ajoutée au dépôt dans cette opération ; son intégration Git doit faire l’objet d’un commit documentaire séparé si souhaité.

## 16. État de clôture
**R8 GLOBAL MIGRATION = CLOSED / COMMITTED / PUSHED / VERIFIED.**

Les deferments de policy restent volontairement documentés et ne constituent pas des blockers de la migration clôturée.

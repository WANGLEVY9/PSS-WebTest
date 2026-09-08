# Phase 2 P1 workflow admission board

**Status:** pre-collection. The P1 design specifies 3 SUTs × 5 workflows × 3 condition strata × 3 reference configurations × 5 repetitions = **675 planned runs**.

No row below is confirmatory-eligible merely because it appears in the design. The board is an implementation checklist, not outcome data.

| Application | Workflow | Complexity | Current status | Independent oracle | Fault slots | Evolution slots | Next admission gate |
|---|---|---|---|---|---|---|---|
| bookstack | bookstack-create-page | multi-step | admitted-pilot-only | persisted-state (independent-verified) | wrong-save-target, persistence-mismatch | dom-wrapper-only, access-name-preserving-layout-change, delayed-save | paired clean/fault pilot is complete; add a behavior-preserving evolution block and do not treat pilot admission as P1 eligibility |
| bookstack | bookstack-open-book-navigate | navigation | candidate | visible-ui (draft) | wrong-book-target | dom-wrapper-only, navigation-layout-change | implement workflow + reset + oracle + fault/evolution controls + three-arm pilot |
| bookstack | bookstack-edit-existing-page | multi-step | candidate | persisted-state (draft) | save-suppressed, stale-page-write | editor-toolbar-layout-change, delayed-save | implement workflow + reset + oracle + fault/evolution controls + three-arm pilot |
| bookstack | bookstack-search-and-open-book2 | search-navigation | candidate | visible-ui (draft) | search-result-mismatch, wrong-book-target | search-layout-change, access-name-preserving-layout-change | implement workflow + reset + oracle + fault/evolution controls + three-arm pilot |
| bookstack | bookstack-create-chapter | multi-step | candidate | persisted-state (draft) | wrong-parent-book, persistence-mismatch | dom-wrapper-only, delayed-save | implement workflow + reset + oracle + fault/evolution controls + three-arm pilot |
| indico | indico-create-event | multi-step | pilot-only | relational (independent-verified) | publish-state-mismatch, date-field-mismatch | form-layout, access-description, delayed-background | freeze v0.2 manifest/provenance; add fault/evolution controls and three-arm admission |
| indico | indico-create-event-with-description | multi-step | candidate | relational (draft) | description-omission, publish-state-mismatch | form-layout, access-description | implement workflow + reset + oracle + fault/evolution controls + three-arm pilot |
| indico | indico-search-and-open-event | search-navigation | candidate | relational (draft) | wrong-event-target | search-layout, access-name-preserving-layout-change | implement workflow + reset + oracle + fault/evolution controls + three-arm pilot |
| indico | indico-edit-event-date | multi-step | candidate | relational (draft) | date-field-mismatch, stale-update | form-layout, delayed-background | implement workflow + reset + oracle + fault/evolution controls + three-arm pilot |
| indico | indico-create-event-with-privacy | multi-step | candidate | relational (draft) | privacy-state-mismatch | form-layout, access-description | implement workflow + reset + oracle + fault/evolution controls + three-arm pilot |
| juice-shop | juice-shop-product-search | search-navigation | pilot-only | visible-ui+relational (independent-verified) | search-omission, product-mismatch | search-layout, accessibility-card, delayed-results | freeze v0.2 manifest/provenance; add fault/evolution controls and three-arm admission |
| juice-shop | juice-shop-register-user | multi-step | candidate | relational (draft) | validation-omission, wrong-field | form-layout, access-description | implement workflow + reset + oracle + fault/evolution controls + three-arm pilot |
| juice-shop | juice-shop-login | multi-step | candidate | relational (draft) | credential-field-mismatch, auth-state-mismatch | form-layout, access-name-preserving-layout-change | implement workflow + reset + oracle + fault/evolution controls + three-arm pilot |
| juice-shop | juice-shop-add-product-to-basket | multi-step | candidate | relational (draft) | wrong-product, basket-omission | product-card-layout, delayed-results | implement workflow + reset + oracle + fault/evolution controls + three-arm pilot |
| juice-shop | juice-shop-checkout-address | multi-step | candidate | relational (draft) | address-field-mismatch, order-omission | checkout-layout, access-description | implement workflow + reset + oracle + fault/evolution controls + three-arm pilot |

## Required per-workflow evidence

| Gate | Required evidence |
|---|---|
| Reset | A deterministic, auditable fresh-state check before every cell. |
| Oracle | An independent clean/fault/unknown postcondition evaluator, never supplied to an agent. |
| Fault | A declared fault positive control plus clean negative control; preserve ambiguous states as unknown. |
| Evolution | A behavior-preservation invariant before a UI change enters the evolution stratum. |
| Arms | All three reference configurations pass observation/provenance contracts and have a clean matched pilot. |

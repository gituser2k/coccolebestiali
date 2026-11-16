# STEP 10 — Cutover definitivo account globale

Data: 2026-11-16  
Branch: `changeaccount`

## Obiettivo

Rimuovere il paradigma a ruolo esclusivo e rendere definitive le strutture multi-profilo introdotte negli STEP 2–9.

## Fonti autorevoli finali

| Ambito | Fonte |
| --- | --- |
| Identità e credenziali | `users` |
| Autorizzazioni e stato onboarding | `user_capabilities` |
| Dati condivisi | `account_profile` |
| Residenza Owner | `owner_profile` |
| Area operativa Assistant | `assistant_profile` |
| Reputazione | `profile_reputation` con PK `(user_id, capability)` |
| Modalità UI corrente | sessione server `cb_portal_ui_mode` |

Un account senza la capability richiesta non riceve accesso implicito: l'autorizzazione fallisce in modo chiuso.

Nella home la CTA di onboarding Assistant è mostrata soltanto quando la capability Assistant è assente oppure in stato `draft|pending_verification`. Con capability `active` viene mostrato lo switch Owner/Assistant e la CTA scompare; gli stati amministrativi `suspended|rejected|disabled` non espongono un comando di riattivazione autonoma.

## Strutture rimosse

- colonna `users.role`;
- tabella `personaldata`;
- tabella `user_reputation`;
- payload opzionale `role` dagli endpoint di registrazione;
- firme email storiche contenenti il ruolo;
- fallback e dual-write applicativi verso le strutture precedenti.

## Migrazione dati

Lo script `php/migration/step10_finalize_multi_profile.sql`:

1. completa le capability Owner e Assistant usando il ruolo storico prima della sua rimozione;
2. completa i profili contestuali dai dati storici senza sovrascrivere righe già migrate;
3. crea le reputazioni mancanti per ogni capability;
4. interrompe il cutover con `SIGNAL` se trova account senza Owner, dati comuni non migrati o capability senza reputazione;
5. solo dopo le verifiche elimina tabelle e colonna legacy.

## Backup e collaudo

Backup privato pre-cutover:

`php/storage/app/private/backups/changeaccount-step10-before-20261116.sql`

SHA-256:

`cbfe94dd829e27839ddcb97ebd56a7b406b8fbd837024d05597fb2271077d874`

Il ripristino è stato verificato su database isolato. Il cutover è stato provato prima su una copia completa: 42 utenti, 83 capability, 83 reputazioni contestuali, zero account senza Owner e zero capability senza reputazione. È stata inoltre verificata una ricostruzione da zero con 46 tabelle applicative, 6 servizi e 11 policy, seguita dal caricamento del dataset demo: 41 account, 41 Owner, 40 Assistant, 81 reputazioni e 6 operatori olistici.

## Rollback

Il rollback è un ripristino completo del dump pre-cutover; non va tentata una ricostruzione parziale delle tre strutture eliminate. Prima del restore fermare le scritture applicative e conservare un ulteriore dump dello stato corrente.

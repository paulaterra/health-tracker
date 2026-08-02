# Paula Tracker v1.3.2 · Mode consulta

## Configuració a Supabase
1. Crea una contrasenya de mínim 10 caràcters.
2. Obre `SUPABASE-ACCES-PROFESSIONAL.sql`.
3. Substitueix `OWNER_EMAIL` pel correu del teu compte de Paula Tracker.
4. Substitueix `PROFESSIONAL_PASSWORD` per la contrasenya que donaràs als professionals.
5. Copia tot el SQL a Supabase > SQL Editor i prem Run.

La contrasenya queda guardada com a hash i no apareix al JavaScript ni a GitHub.

## Prova
- Obre l'app en una finestra privada.
- Prem `Accés professionals`.
- Introdueix la contrasenya.
- Els apartats de consulta funcionen; els formularis apareixen bloquejats.

La sessió de consulta dura 12 hores. La contrasenya continua sent permanent fins que tornis a executar el bloc de configuració amb una contrasenya nova.

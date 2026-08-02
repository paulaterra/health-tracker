# Quadern de salut — versió 2

Aquesta versió conserva totes les funcions existents i centralitza l'anàlisi en un únic motor compartit:

- Dashboard: resum intel·ligent compacte.
- Patrons detectats: relacions i hipòtesis.
- Conclusions i recomanacions: interpretació prudent i accions de seguiment.
- Informes: informe complet del període, botó de PDF, impressió i exportació JSON.
- Dolor corporal: mapa detallat, selecció de zones, dibuix/pinzel i tipus de dolor.

## Correcció principal

S'ha corregit l'error que deixava l'informe bloquejat a «Generant informe…». El resum intel·ligent ara es calcula abans de renderitzar l'informe i respecta el període seleccionat.

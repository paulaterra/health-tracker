# Paula Tracker · Patrons V3 (preview)

Aquesta versió endureix el motor de patrons perquè prefereixi no mostrar res abans que mostrar relacions poc fiables.

Canvis principals:
- El cicle menstrual no genera cap hipòtesi si no hi ha menstruacions realment registrades.
- Amb un sol inici de menstruació no es mostren patrons individuals; calen almenys 2 cicles comparables per un senyal repetit i 3 per pujar-lo a patró detectat.
- Les finestres del cicle només compten si hi ha prou dies amb registres reals en aquella finestra.
- Les correlacions separen coincidències del mateix dia i seqüències temporals.
- S'eliminen relacions redundants dins del mateix àmbit (p. ex. dolor general ↔ dolor màxim).
- Els llindars són més estrictes: més cobertura, més repeticions i més diferència entre grups.
- Els passos diaris es comparen amb llindars derivats de les pròpies dades, no amb l'escala 0–10.
- Les conclusions només converteixen una relació en possible factor previ/protector quan és plausible i supera el nivell d'observació.
- Un símptoma mai es considera factor protector.
- Cada relació mostra evidència comparable (percentatge d'episodis alts i nombre de dies de cada grup).

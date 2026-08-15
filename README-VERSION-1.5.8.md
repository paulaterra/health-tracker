# Paula Tracker v1.5.8

Millora additiva de **Patrons detectats**. Manté intactes les correlacions, seqüències, ritmes setmanals i tendències existents i hi afegeix una capa temporal nova:

- detecció d'episodis consecutius per símptoma;
- brots multisimptomàtics ja existents, ara contextualitzats amb episodis;
- periodicitat aproximada entre episodis quan hi ha almenys 3 repeticions;
- comparació de setmanes per detectar setmanes de més càrrega simptomàtica;
- evolució conjunta de dominis entre setmanes;
- tendències a llarg termini amb setmanes/mesos suficients;
- integració amb els patrons del cicle ja existents.

El motor és conservador: si no hi ha prou períodes comparables, mostra que encara està aprenent en lloc d'inventar una periodicitat.

# Paula Tracker v1.3.6

## Recuperació de contrasenya

Quan l'usuària obre un enllaç de recuperació de Supabase, l'app detecta l'esdeveniment `PASSWORD_RECOVERY` i mostra un formulari per definir i confirmar la nova contrasenya.

- Validació mínima de 8 caràcters.
- Confirmació de coincidència.
- Actualització mitjançant `supabase.auth.updateUser`.
- Tancament de la sessió temporal després del canvi.
- Missatge de confirmació i retorn a l'inici de sessió.

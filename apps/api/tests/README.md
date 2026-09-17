# Tests automatisés — API Adresse GN

Commande :

```powershell
& ".\.venv\Scripts\python.exe" ".\apps\api\manage.py" test tests --settings=config.settings_test --verbosity 2
```

Principes :

- `config.settings_test` isole la suite unitaire.
- SQLite en mémoire uniquement.
- Aucun accès à Supabase réel.
- Aucun appel réseau Supabase Auth.
- Les accès SQL du guard lifecycle sont simulés.
- Les futurs tests PostgreSQL/Supabase seront séparés et opt-in.

Couverture initiale :

- compte actif / désactivé ;
- fraîcheur de session après réactivation ;
- transmission des claims JWT au guard lifecycle ;
- confirmations `DESACTIVER` et `REACTIVER` ;
- méthodes de vérification autorisées.

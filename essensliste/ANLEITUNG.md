# Brotzeit Liste WA2A – gemeinsame Liste für alle Geräte

`index.html` ist die bestehende Brotzeit Liste (V11) mit unveränderter Oberfläche.
Neu ist ein gemeinsamer Speicher:

- Alle Kollegen sehen dieselbe Liste in Echtzeit: Bestellungen, Anwesenheit, Abendessen, Preise, PayPal und „bezahlt“.
- Die Liste wird **26 Stunden nach dem ersten Eintrag automatisch gelöscht**.
  - So kann man nach der Schicht noch sehen, wer nicht bezahlt hat.
  - Der nächste Dienst startet mit einer leeren Liste.
- Ohne Firebase-Einrichtung läuft die App im **lokalen Modus**: Die Daten bleiben dann nur auf dem jeweiligen Gerät.

## Einrichtung (einmalig, ca. 10 Minuten)

1. Auf https://console.firebase.google.com ein Projekt anlegen, z. B. `essensliste-wa2a`. Google Analytics wird nicht benötigt.
2. **Firestore Database** → „Datenbank erstellen“ → Standort `eur3` (Europa) → Produktionsmodus.
3. Unter Firestore → **Regeln** den Inhalt von `firestore.rules` einfügen und veröffentlichen.
4. Optional, aber empfohlen: Firestore → **TTL** → Richtlinie für die Sammlung `essensliste`, Feld `expireAt`. Dann löscht Google die Daten auch dann, wenn niemand die App öffnet (Datenschutz).
5. Projekteinstellungen → „Meine Apps“ → Web-App (`</>`) hinzufügen. Die angezeigte `firebaseConfig` kopieren.
6. In `index.html` oben bei `window.ESSEN_FIREBASE_CONFIG = null;` das `null` durch die Config ersetzen. Ein Beispiel steht direkt darunter.
7. `index.html` ins Repo `Essensliste-WA2A-` kopieren. GitHub Pages aktualisiert sich nach etwa einer Minute.

Die Firebase-Web-Config ist kein Geheimnis: Sie steht in jeder Web-App im Klartext. Den Schutz übernehmen die Regeln in `firestore.rules`.

## Hinweise

- **Kein Login:** Jeder mit dem Link kann Einträge ändern. Das entspricht der bisherigen App.
- **Kosten:** Das Gratis-Kontingent (50.000 Lesezugriffe pro Tag) reicht für eine Wache bei Weitem.
- **Namen:** Die Namen der Kollegen stehen wie bisher fest im Code.

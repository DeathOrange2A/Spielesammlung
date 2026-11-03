# 🎲 Spieleabend

Web-App für Spieleabende – läuft im Browser, ein Handy reicht. Mitspielende können optional per QR-Code/Link mit dem eigenen Handy beitreten.

**Enthalten:**
- 🐺 **Werwolf** – die App leitet selbst (Sprachausgabe, Aktionen auf den Handys) *oder* hilft einer menschlichen Spielleitung (Skript, Rollenübersicht, Tote, Liebespaar, Tränke, Timer)
- 🕵️ **Imposter** – 10 Wortpakete + eigene Kategorien, Anzahl Imposter, Timer, Undercover-Modus
- 🃏 **Cabo**-Zähler (Cabo-Rufer, Kamikaze, 100 → 50)
- 🧙 **Wizard**-Zähler (Ansagen, Stiche, automatische Wertung)
- ⚔️ **Munchkin**-Zähler (Stufe, Ausrüstung, Kampfrechner, Würfel)
- 🎲 **Kniffel**-Block – in der App würfeln (3 Würfe, Würfel halten, Punktevorschläge) oder mit eigenen Würfeln den Wurf eintippen
- 🏆 **Abend-Ranking** über alle Spiele – Spieler einmal eintragen, alle Spiele übernehmen sie automatisch
- 📖 Anleitungen zu allen Spielen

## So funktioniert's

- Das Gerät, auf dem die Startseite geöffnet ist, ist die **Spielleitung**. Dort liegen alle Daten (im Browser gespeichert).
- **📱 Handys verbinden** zeigt QR-Code, Link und Raum-Code. Wer beitritt, wählt seinen Namen und bleibt den ganzen Abend verbunden.
- Wer nicht verbunden ist, spielt **auf dem Gerät der Spielleitung** – die App sagt dann „Gib das Handy an …“. Beides lässt sich mischen.

## Auf Render.com veröffentlichen

1. Diesen Ordner in ein GitHub-Repository hochladen.
2. Auf [render.com](https://render.com) → **New → Web Service** → Repository auswählen.
3. Einstellungen:
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free** reicht
4. Fertig – die App läuft unter `https://<name>.onrender.com`.

Alternativ erkennt Render die Datei `render.yaml` automatisch (**New → Blueprint**).

> Hinweis: Kostenlose Render-Instanzen schlafen nach ca. 15 Minuten ohne Besucher ein. Der erste Aufruf dauert dann bis zu einer Minute. Die Räume liegen nur im Arbeitsspeicher; schläft der Server ein, verbinden sich Spielleitung und Handys beim nächsten Öffnen automatisch neu.

## 🥖 Brotkarte Hannover (`/brot`)

Eigene kleine App im selben Projekt: eine echte Karte von Hannover, auf der ihr Bäckereien markiert, Brote eintragt (Name, Ort, Preis, Datum, Notiz) und jeweils **pur** und **getoastet** bewertet, wahlweise auf 1–10 oder 1–5 Sternen. Dazu eine Übersicht mit Durchschnitten, Rangliste der Bäckereien und Brote „von unterwegs“.

- Läuft unter `https://<name>.onrender.com/brot/`, lässt sich aufs Handy installieren (iPhone: Teilen → „Zum Home-Bildschirm“) und zeigt offline den letzten Stand.
- Karte: OpenStreetMap / CARTO, Adresssuche, eigener Standort, alle Bäckereien aus OpenStreetMap als antippbare Punkte.
- Gemeinsame Daten liegen in **Supabase** (kostenlos). Ohne Supabase gibt es einen Testmodus, der nur im eigenen Browser speichert.

### Supabase einrichten (einmalig, ca. 10 Minuten)

1. Auf [supabase.com](https://supabase.com) kostenlos registrieren → **New project** (Region z. B. Frankfurt, Passwort egal, wird nicht gebraucht).
2. Links **SQL Editor** → **New query** → den Inhalt von [`supabase/brotkarte.sql`](supabase/brotkarte.sql) einfügen → **Run**.
3. **Authentication → Users → Add user → Create new user**: für euch beide je eine E-Mail und ein Passwort anlegen, Haken bei **Auto Confirm User** setzen.
4. **Authentication → Sign In / Providers**: **Allow new users to sign up** ausschalten. Dann kommt niemand außer euch beiden an die Daten.
5. **Project Settings → API**: **Project URL** und den **anon public**-Key kopieren und in [`public/brot/config.js`](public/brot/config.js) eintragen, committen, pushen. (Der anon-Key darf öffentlich sein; geschützt wird über Anmeldung und die Regeln aus dem SQL-Skript.)
6. Render baut neu → `/brot/` öffnen → anmelden → Namen eingeben → fertig.

> Hinweis: Kostenlose Supabase-Projekte pausieren nach 7 Tagen ganz ohne Nutzung. Die Daten bleiben erhalten; im Supabase-Dashboard auf **Restore** klicken. In den Einstellungen der App lässt sich außerdem jederzeit alles als CSV sichern.

## Lokal starten

```bash
npm install
npm start
```

Dann `http://localhost:3000` öffnen.

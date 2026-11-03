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
- 🍺 **Guinness-Pfad Hannover** unter `/guinness/`: Karte aller Bars mit Guinness vom Fass, Preisübersicht und Abhaken für die Challenge (Fortschritt bleibt im Browser gespeichert)

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

## Lokal starten

```bash
npm install
npm start
```

Dann `http://localhost:3000` öffnen.

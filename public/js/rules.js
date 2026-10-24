// Anleitungen (statisches HTML).
export const RULES = {
  werwolf: {
    title: '🐺 Werwolf – Anleitung',
    html: `
<p>Ein Dorf wird nachts von Werwölfen heimgesucht. Tagsüber versuchen die Dorfbewohner, die Werwölfe zu entlarven – die Werwölfe tarnen sich als harmlose Nachbarn.</p>
<h4>Ziel</h4>
<ul>
  <li><b>Dorf:</b> Alle Werwölfe sind ausgeschieden.</li>
  <li><b>Werwölfe:</b> Sie sind mindestens so viele wie alle anderen zusammen.</li>
  <li><b>Liebespaar</b> (Werwolf + Dorfbewohner): Die beiden sind als Letzte übrig.</li>
</ul>
<h4>Ablauf</h4>
<ol>
  <li><b>Rollen verteilen:</b> Jeder sieht geheim seine Karte – auf dem eigenen Handy oder auf dem herumgereichten Gerät.</li>
  <li><b>Nacht:</b> Alle schließen die Augen. Nacheinander erwachen: Amor (nur 1. Nacht) → Verliebte (nur 1. Nacht) → Beschützer → Werwölfe → Seherin → Hexe.</li>
  <li><b>Morgen:</b> Die Opfer der Nacht werden verkündet und scheiden aus (Rolle wird aufgedeckt).</li>
  <li><b>Tag:</b> Alle diskutieren und stimmen ab. Wer die meisten Stimmen hat, scheidet aus. Bei Gleichstand stirbt (je nach Einstellung) niemand.</li>
  <li>Nacht und Tag wechseln sich ab, bis eine Seite gewinnt.</li>
</ol>
<p>Ausgeschiedene dürfen nicht mehr mitreden und nichts verraten.</p>
<h4>Rollen</h4>
<ul>
  <li>🐺 <b>Werwolf:</b> Wählt nachts gemeinsam mit den anderen Werwölfen ein Opfer.</li>
  <li>🧑‍🌾 <b>Dorfbewohner:</b> Keine Fähigkeit – nur Verstand und Stimme.</li>
  <li>🔮 <b>Seherin:</b> Sieht jede Nacht die Rolle einer Person.</li>
  <li>🧪 <b>Hexe:</b> Hat je einmal pro Spiel einen Heiltrank (rettet das Opfer der Nacht) und einen Gifttrank (tötet jemanden).</li>
  <li>🏹 <b>Jäger:</b> Stirbt er, nimmt er sofort eine Person mit in den Tod.</li>
  <li>💘 <b>Amor:</b> Verliebt in der ersten Nacht zwei Personen. Stirbt eine, stirbt die andere aus Kummer.</li>
  <li>🛡️ <b>Beschützer:</b> Schützt jede Nacht eine Person vor den Werwölfen – nicht zweimal hintereinander dieselbe.</li>
  <li>👧 <b>Mädchen:</b> Darf nachts blinzeln, wenn die Werwölfe erwachen. In der App-Leitung bekommt sie (mit eigenem Handy) einen Hinweis: „A oder B ist ein Werwolf“.</li>
</ul>
<h4>Empfohlene Verteilung</h4>
<table>
  <tr><th>Spieler</th><th>Werwölfe</th><th>Sonderrollen</th></tr>
  <tr><td>4–5</td><td>1</td><td>Seherin (ab 5)</td></tr>
  <tr><td>6</td><td>1</td><td>Seherin, Hexe</td></tr>
  <tr><td>7–8</td><td>2</td><td>+ Jäger, + Amor (ab 8)</td></tr>
  <tr><td>9–12</td><td>2–3</td><td>+ Beschützer (ab 10), + Mädchen (ab 11)</td></tr>
  <tr><td>13+</td><td>3–4</td><td>alle</td></tr>
</table>
<h4>Spielleiter-Skript</h4>
<p class="script">„Es wird Nacht im Dorf. Alle schließen die Augen.“<br>
„Amor erwacht und zeigt auf zwei Personen, die sich verlieben. … Amor schläft wieder ein.“ (nur 1. Nacht – tippe die Verliebten an)<br>
„Die Verliebten erwachen, erkennen einander und schlafen wieder ein.“<br>
„Der Beschützer erwacht und zeigt, wen er beschützt. … Er schläft wieder ein.“<br>
„Die Werwölfe erwachen, erkennen einander und einigen sich leise auf ein Opfer. … Sie schlafen wieder ein.“<br>
„Die Seherin erwacht und zeigt auf eine Person.“ (Zeige ihr die Rolle.) „… Sie schläft wieder ein.“<br>
„Die Hexe erwacht.“ (Zeige ihr das Opfer.) „Willst du deinen Heiltrank benutzen? Deinen Gifttrank? … Die Hexe schläft wieder ein.“<br>
„Das Dorf erwacht. Heute Nacht ist … gestorben.“</p>
<h4>So hilft die App</h4>
<ul>
  <li><b>🤖 App leitet:</b> Die App erzählt mit Sprachausgabe, ruft die Rollen auf und wertet aus. Mit eigenem Handy handelt jede Rolle direkt dort. Spieler ohne Handy nehmen nachts heimlich das Gerät, wenn ihre Rolle gerufen wird („Gerufene Rolle: hier tippen“). Abgestimmt wird am Tag auf den Handys bzw. per Auswahl auf dem Gerät.</li>
  <li><b>🧑‍⚖️ Eigene Spielleitung:</b> Die App verteilt die Karten. Die Spielleitung sieht alle Rollen, bekommt das Skript für jede Nacht, verwaltet Tote, Liebespaar und Hexentränke und hat einen Diskussions-Timer.</li>
</ul>`,
  },

  imposter: {
    title: '🕵️ Imposter – Anleitung',
    html: `
<p>Alle bekommen dasselbe geheime Wort – nur der Imposter nicht. Wer blufft hier?</p>
<h4>Ablauf</h4>
<ol>
  <li>Kategorien, Anzahl der Imposter und Zeit einstellen.</li>
  <li>Jeder schaut sich geheim seine Karte an (eigenes Handy oder herumgereichtes Gerät). Die Crew sieht das Wort, der Imposter sieht „Imposter“ (optional mit der Kategorie als Hinweis).</li>
  <li>Die angezeigte Startperson beginnt. Reihum sagt jede Person <b>ein Wort oder einen kurzen Satz</b> zum Begriff – genau genug, um zu zeigen, dass man das Wort kennt, aber vage genug, dass der Imposter es nicht errät.</li>
  <li>Gerne mehrere Runden, dann diskutieren, bis die Zeit abläuft.</li>
  <li>Abstimmen: Auf drei zeigen alle auf ihren Verdacht. Die Spielleitung trägt die Verdächtigen ein.</li>
</ol>
<h4>Wer gewinnt?</h4>
<ul>
  <li>Wurden <b>alle Imposter</b> erwischt, darf der Imposter noch einmal das Wort raten. Richtig geraten → Imposter gewinnt, sonst gewinnt die Crew.</li>
  <li>Wurde ein Unschuldiger verdächtigt, gewinnt der Imposter.</li>
</ul>
<h4>Varianten</h4>
<ul>
  <li><b>Hinweis für den Imposter:</b> Er sieht die Kategorie – macht es fairer für Einsteiger.</li>
  <li><b>Undercover:</b> Der Imposter bekommt ein ähnliches Wort aus derselben Kategorie und weiß nicht, dass er der Imposter ist.</li>
  <li><b>Eigene Kategorien:</b> Legt eigene Wortlisten an (z. B. Insider aus eurem Freundeskreis).</li>
</ul>`,
  },

  cabo: {
    title: '🃏 Cabo – Anleitung',
    html: `
<p>Sammle möglichst <b>wenige Punkte</b>, indem du deine verdeckten Karten gegen niedrige tauschst – obwohl du sie kaum kennst.</p>
<h4>Material & Vorbereitung</h4>
<ul>
  <li>Karten mit Werten 0–13. Jeder bekommt 4 Karten verdeckt in einer Reihe vor sich.</li>
  <li>Zu Beginn darf jeder <b>2 seiner eigenen Karten</b> einmal ansehen.</li>
  <li>Eine Karte wird als Ablagestapel aufgedeckt.</li>
</ul>
<h4>Dein Zug</h4>
<ol>
  <li><b>Vom Nachziehstapel ziehen</b> und dann entweder
    <ul><li>gegen eine eigene Karte tauschen (die alte kommt offen auf die Ablage), oder</li>
    <li>direkt ablegen – bei Aktionskarten darfst du dann die Aktion ausführen.</li></ul></li>
  <li><b>Oder die oberste Ablagekarte nehmen</b> – die musst du gegen eine eigene Karte tauschen.</li>
</ol>
<p><b>Mehrere gleiche Karten tauschen:</b> Du darfst die gezogene Karte gegen 2 oder mehr eigene Karten tauschen, wenn diese alle den gleichen Wert haben. Irrst du dich, bleiben die Karten liegen und du musst die gezogene Karte zusätzlich offen in deine Reihe legen.</p>
<h4>Aktionskarten (nur direkt vom Nachziehstapel abgelegt)</h4>
<ul>
  <li><b>7 / 8 – Peek:</b> Eine eigene Karte ansehen.</li>
  <li><b>9 / 10 – Spy:</b> Eine Karte eines Mitspielers ansehen.</li>
  <li><b>11 / 12 – Swap:</b> Eine eigene Karte mit der eines Mitspielers blind tauschen.</li>
</ul>
<h4>Cabo rufen</h4>
<p>Statt deines Zuges rufst du „Cabo“, wenn du glaubst, die niedrigste Summe zu haben. Alle anderen haben noch genau einen Zug, deine Karten dürfen nicht mehr verändert werden. Dann werden alle Karten aufgedeckt.</p>
<h4>Wertung</h4>
<ul>
  <li>Jeder bekommt die Summe seiner Karten.</li>
  <li>Hat der <b>Cabo-Rufer</b> die niedrigste Summe, bekommt er <b>0 Punkte</b>. Sonst bekommt er seine Summe <b>+ 5 Strafpunkte</b>. (Gleichstand: einstellbar.)</li>
  <li><b>Kamikaze:</b> Wer genau 12, 12, 13, 13 hat, bekommt 0 – alle anderen 50 Punkte.</li>
  <li><b>Genau 100 Punkte:</b> Man fällt auf 50 zurück (einmal pro Spiel).</li>
</ul>
<h4>Spielende</h4>
<p>Sobald jemand über 100 Punkte hat, endet das Spiel. Die niedrigste Gesamtpunktzahl gewinnt.</p>`,
  },

  wizard: {
    title: '🧙 Wizard – Anleitung',
    html: `
<p>Sage in jeder Runde genau vorher, wie viele Stiche du machst.</p>
<h4>Material</h4>
<ul>
  <li>60 Karten: Zahlen 1–13 in vier Farben, 4 <b>Zauberer</b> (Z) und 4 <b>Narren</b> (N).</li>
  <li>3–6 Spieler. Runden: 3 Sp. = 20, 4 Sp. = 15, 5 Sp. = 12, 6 Sp. = 10.</li>
</ul>
<h4>Ablauf einer Runde</h4>
<ol>
  <li>In Runde 1 bekommt jeder 1 Karte, in Runde 2 zwei Karten usw. Der Geber wechselt im Uhrzeigersinn.</li>
  <li><b>Trumpf:</b> Die nächste Karte vom Stapel wird aufgedeckt. Zahl = Trumpffarbe. Zauberer = der Geber wählt Trumpf. Narr = kein Trumpf. In der letzten Runde gibt es keinen Trumpf.</li>
  <li><b>Ansagen:</b> Links vom Geber beginnend sagt jeder, wie viele Stiche er macht.</li>
  <li><b>Stiche:</b> Links vom Geber wird ausgespielt. Farbe muss bedient werden, Zauberer und Narren dürfen immer gespielt werden.</li>
</ol>
<h4>Wer gewinnt den Stich?</h4>
<ul>
  <li>Der erste Zauberer gewinnt immer.</li>
  <li>Sonst die höchste Trumpfkarte, sonst die höchste Karte der ausgespielten Farbe.</li>
  <li>Narren verlieren immer – nur wenn alle Narren spielen, gewinnt der erste Narr.</li>
  <li>Wird ein Narr ausgespielt, bestimmt die erste Zahlenkarte die Farbe. Wird ein Zauberer ausgespielt, darf jeder beliebig spielen.</li>
</ul>
<h4>Wertung</h4>
<ul>
  <li>Ansage richtig: <b>20 Punkte + 10 pro Stich</b>.</li>
  <li>Ansage falsch: <b>−10 Punkte pro Stich Abweichung</b>.</li>
</ul>
<p>Variante: Die Summe aller Ansagen darf nicht der Kartenzahl entsprechen (es muss also jemand danebenliegen). In der App einschaltbar.</p>
<h4>Spielende</h4>
<p>Nach der letzten Runde gewinnt, wer die meisten Punkte hat.</p>`,
  },

  kniffel: {
    title: '🎲 Kniffel – Anleitung',
    html: `
<p>Würfle mit 5 Würfeln möglichst gute Kombinationen und fülle deinen Block. Die höchste Gesamtpunktzahl gewinnt.</p>
<h4>Dein Zug</h4>
<ol>
  <li>Du hast bis zu <b>3 Würfe</b>. Nach jedem Wurf darfst du beliebige Würfel liegen lassen (halten) und die übrigen neu würfeln.</li>
  <li>Danach musst du den Wurf in <b>ein freies Feld</b> eintragen. Passt nichts, streichst du ein Feld (0 Punkte).</li>
  <li>Jedes Feld wird genau einmal belegt. Nach 13 Runden ist der Block voll.</li>
</ol>
<h4>Oberer Teil</h4>
<ul>
  <li>Einser bis Sechser: Summe aller Würfel mit dieser Augenzahl.</li>
  <li><b>Bonus +35</b>, wenn der obere Teil mindestens <b>63</b> Punkte hat (z. B. je drei gleiche von jeder Zahl).</li>
</ul>
<h4>Unterer Teil</h4>
<table>
  <tr><th>Feld</th><th>Bedingung</th><th>Punkte</th></tr>
  <tr><td>Dreierpasch</td><td>3 gleiche</td><td>Augensumme</td></tr>
  <tr><td>Viererpasch</td><td>4 gleiche</td><td>Augensumme</td></tr>
  <tr><td>Full House</td><td>3 gleiche + 2 gleiche</td><td>25</td></tr>
  <tr><td>Kleine Straße</td><td>4 in Folge</td><td>30</td></tr>
  <tr><td>Große Straße</td><td>5 in Folge</td><td>40</td></tr>
  <tr><td>Kniffel</td><td>5 gleiche</td><td>50</td></tr>
  <tr><td>Chance</td><td>beliebig</td><td>Augensumme</td></tr>
</table>
<h4>In der App</h4>
<ul>
  <li><b>📱 In der App würfeln:</b> Würfeln-Knopf drücken, Würfel zum Halten antippen. Die App zeigt für jedes freie Feld die möglichen Punkte – das beste ist grün markiert.</li>
  <li><b>🎲 Eigene Würfel:</b> Würfelt echt und tippt am Ende des Zugs die 5 Augenzahlen ein. Die App rechnet die Punkte aus.</li>
  <li>Variante <b>Extra-Kniffel:</b> Jeder weitere Kniffel bringt +50 Bonus, wenn das Kniffel-Feld schon mit 50 belegt ist.</li>
</ul>`,
  },

  munchkin: {
    title: '⚔️ Munchkin – Anleitung',
    html: `
<p>Töte Monster, schnapp dir Schätze und erreiche als Erster <b>Stufe 10</b>.</p>
<h4>Dein Zug</h4>
<ol>
  <li><b>Tür eintreten:</b> Oberste Türkarte aufdecken. Monster → Kampf. Fluch → wirkt sofort. Sonst auf die Hand nehmen.</li>
  <li>Kein Monster? Dann <b>Ärger suchen</b> (ein Monster von der Hand bekämpfen) oder <b>Raum plündern</b> (eine Türkarte verdeckt ziehen).</li>
  <li><b>Milde Gabe:</b> Mehr als 5 Handkarten? Überzählige an den Spieler mit der niedrigsten Stufe abgeben.</li>
</ol>
<h4>Kampf</h4>
<ul>
  <li>Deine <b>Kampfstärke = Stufe + Ausrüstungsboni</b> (+ Einmal-Effekte).</li>
  <li>Du gewinnst, wenn du <b>stärker</b> als das Monster bist (Gleichstand gewinnt das Monster – außer für Krieger).</li>
  <li>Sieg: +1 Stufe (manche Monster mehr) und die Schätze des Monsters.</li>
  <li>Du darfst <b>einen Helfer</b> bitten – oft gegen einen Anteil an der Beute.</li>
  <li>Alle anderen dürfen sich mit Karten einmischen.</li>
</ul>
<h4>Weglaufen</h4>
<p>Würfle: Bei <b>5 oder 6</b> entkommst du. Sonst trifft dich die „Schlimme Sache“ des Monsters (bis hin zum Tod).</p>
<h4>Stufen</h4>
<ul>
  <li>Stufe 1 ist das Minimum. Für je 1.000 Goldstücke verkaufter Gegenstände gibt es eine Stufe.</li>
  <li>Die letzte Stufe (10) bekommt man nur durch das Töten eines Monsters.</li>
  <li>Tod: Man verliert alle Karten, behält aber Stufe, Rasse und Klasse.</li>
</ul>
<p>Epic Munchkin: Spiel bis Stufe 20 – in der App einstellbar.</p>`,
  },
};

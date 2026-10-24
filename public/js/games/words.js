// Wortpakete für Imposter.
const list = s => s.split(',').map(w => w.trim()).filter(Boolean);

export const PACKS = [
  {
    id: 'orte', emoji: '📍', name: 'Bekannte Orte',
    words: list('Strand, Flughafen, Krankenhaus, Schule, Kino, Supermarkt, Bahnhof, Zoo, Freizeitpark, Bibliothek, Fitnessstudio, Restaurant, Kirche, Museum, Schwimmbad, Bäckerei, Polizeiwache, Friseursalon, Zahnarztpraxis, Campingplatz, Skigebiet, Kreuzfahrtschiff, Raumstation, U-Boot, Bauernhof, Tankstelle, Hotel, Casino, Gefängnis, Wüste, Dschungel, Disco, Hochzeit, Weihnachtsmarkt, Oktoberfest, Baumarkt, Fußballstadion, Zirkus, Burg, Leuchtturm, Bergwerk, Theater, Autowaschanlage, Universität, Spielplatz, Sauna, Friedhof, Rathaus, Festival, Bowlingbahn'),
  },
  {
    id: 'welt', emoji: '🌍', name: 'Städte & Sehenswürdigkeiten',
    words: list('Eiffelturm, Brandenburger Tor, Kolosseum, Freiheitsstatue, Big Ben, Pyramiden von Gizeh, Chinesische Mauer, Taj Mahal, Schloss Neuschwanstein, Kölner Dom, Opernhaus Sydney, Golden Gate Bridge, Mount Everest, Niagarafälle, Venedig, Las Vegas, New York, Paris, Rom, Tokio, Berlin, Hamburg, München, London, Mallorca, Hawaii, Island, Sahara, Amazonas, Nordpol, Machu Picchu, Stonehenge, Akropolis, Hollywood, Zugspitze, Sylt, Bodensee, Dubai, Rio de Janeiro, Schiefer Turm von Pisa, Grand Canyon, Alpen, Barcelona, Amsterdam, Wien'),
  },
  {
    id: 'filme', emoji: '🎬', name: 'Filme & Serien',
    words: list('Titanic, Harry Potter, Star Wars, Der Herr der Ringe, Der König der Löwen, Findet Nemo, Shrek, Die Eiskönigin, Jurassic Park, Avatar, Matrix, Zurück in die Zukunft, Der Pate, Forrest Gump, Fluch der Karibik, Spider-Man, Batman, Avengers, Toy Story, Ice Age, Minions, Breaking Bad, Game of Thrones, Stranger Things, Friends, Die Simpsons, SpongeBob, Tatort, Squid Game, Haus des Geldes, The Office, James Bond, Indiana Jones, E.T., Der Grinch, Kevin – Allein zu Haus, Ghostbusters, Rocky, Barbie, Top Gun, Mamma Mia!, Pippi Langstrumpf, Die drei ???, Sissi, Der Schuh des Manitu, Fack ju Göhte, Dark, Wednesday'),
  },
  {
    id: 'tiere', emoji: '🐾', name: 'Tiere',
    words: list('Elefant, Giraffe, Pinguin, Katze, Hund, Delfin, Hai, Löwe, Tiger, Känguru, Koala, Panda, Eichhörnchen, Igel, Fledermaus, Eule, Papagei, Krokodil, Schlange, Schildkröte, Frosch, Biene, Spinne, Schnecke, Kuh, Schwein, Pferd, Esel, Kamel, Lama, Zebra, Nashorn, Nilpferd, Gorilla, Faultier, Flamingo, Storch, Wal, Qualle, Oktopus, Maulwurf, Fuchs, Wolf, Bär, Hamster, Ameise, Marienkäfer, Waschbär'),
  },
  {
    id: 'essen', emoji: '🍕', name: 'Essen & Trinken',
    words: list('Pizza, Döner, Sushi, Spaghetti, Burger, Pommes, Currywurst, Schnitzel, Brezel, Käsespätzle, Lasagne, Tacos, Pfannkuchen, Waffeln, Schwarzwälder Kirschtorte, Apfelstrudel, Eis, Popcorn, Schokolade, Gummibärchen, Croissant, Müsli, Rührei, Avocado, Banane, Wassermelone, Ananas, Erdbeere, Kartoffelsalat, Bratwurst, Raclette, Fondue, Kaffee, Tee, Bier, Wein, Smoothie, Kürbissuppe, Falafel, Ramen, Leberkäse, Sauerkraut, Rouladen, Zuckerwatte, Lebkuchen, Glühwein, Honig'),
  },
  {
    id: 'berufe', emoji: '👷', name: 'Berufe',
    words: list('Ärztin, Feuerwehrmann, Polizistin, Lehrer, Koch, Pilotin, Astronaut, Bäcker, Friseurin, Tierärztin, Programmierer, Architektin, Zahnarzt, Busfahrer, Postbote, Bäuerin, Gärtner, Elektriker, Klempner, Schauspielerin, Musiker, Fotografin, Journalist, Anwältin, Richter, Detektiv, Zauberer, Clown, Bademeister, DJ, Influencerin, Kellner, Krankenpfleger, Mechanikerin, Tischler, Fußballprofi, Model, Pfarrer, Bürgermeisterin, Kapitän, Hebamme, Metzger, Bibliothekarin, Müllmann, Stewardess'),
  },
  {
    id: 'sport', emoji: '⚽', name: 'Sport & Hobbys',
    words: list('Fußball, Basketball, Tennis, Schwimmen, Skifahren, Snowboarden, Surfen, Klettern, Boxen, Golf, Reiten, Yoga, Bowling, Darts, Schach, Tischtennis, Volleyball, Handball, Eishockey, Formel 1, Radfahren, Joggen, Tanzen, Angeln, Kochen, Gärtnern, Stricken, Malen, Zocken, Karaoke, Camping, Wandern, Fallschirmspringen, Bungee-Jumping, Minigolf, Billard, Kanufahren, Turnen, Marathon, Paintball, Puzzeln, Fotografieren, Schlittschuhlaufen, Bogenschießen, Segeln'),
  },
  {
    id: 'dinge', emoji: '🧸', name: 'Alltagsgegenstände',
    words: list('Zahnbürste, Regenschirm, Handy, Kühlschrank, Staubsauger, Schlüssel, Brille, Kopfhörer, Kerze, Spiegel, Toaster, Waschmaschine, Fernbedienung, Kissen, Wecker, Fahrrad, Rucksack, Taschenlampe, Schere, Hammer, Föhn, Gießkanne, Bügeleisen, Geldbeutel, Armbanduhr, Laptop, Kaffeemaschine, Mikrowelle, Teddybär, Luftballon, Sonnenbrille, Kamera, Gitarre, Klavier, Skateboard, Trampolin, Zelt, Koffer, Besen, Klebeband, Pflaster, Lineal, Feuerzeug, Badewanne, Kugelschreiber'),
  },
  {
    id: 'figuren', emoji: '🦸', name: 'Berühmte Figuren',
    words: list('Micky Maus, Harry Potter, Sherlock Holmes, Pippi Langstrumpf, Super Mario, Pikachu, Batman, Darth Vader, Gandalf, Homer Simpson, SpongeBob, Elsa, Shrek, Asterix, Biene Maja, Weihnachtsmann, Osterhase, Rotkäppchen, Schneewittchen, Dracula, Frankenstein, Pinocchio, Peter Pan, Tarzan, Sandmännchen, Die Maus, Bob der Baumeister, Winnie Puuh, Garfield, Hulk, Iron Man, Yoda, Gollum, Jack Sparrow, James Bond, Lara Croft, Sonic, Grinch, Spider-Man, Hermine Granger, Wonder Woman, Rapunzel, Aschenputtel, Captain Hook, Obelix'),
  },
  {
    id: 'kinder', emoji: '🧒', name: 'Einfach (für Kinder)',
    words: list('Hund, Katze, Ball, Auto, Haus, Sonne, Mond, Baum, Blume, Eis, Apfel, Banane, Schule, Bett, Buch, Zug, Flugzeug, Schiff, Regen, Schnee, Geburtstag, Kuchen, Prinzessin, Pirat, Drache, Ritter, Dinosaurier, Roboter, Schaukel, Rutsche, Teddy, Puppe, Ente, Fisch, Pferd, Schmetterling, Regenbogen, Weihnachten, Ostern, Zahnbürste'),
  },
];

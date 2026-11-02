# Szigetbirodalom – V8 (tesztelt fejlesztői változat)

## Mit tartalmaz?
Böngészős, privát szobás játék 2–4 főre, hatszögletű térképpel, nyersanyagokkal, építéssel, rablóval, fejlesztéskártyákkal, kikötői és játékosok közötti kereskedéssel. Messengerbe másolható szobalink. A játékhoz nincs szükség külön mobilalkalmazásra.

## Indítás helyi gépen
Node.js 18+ szükséges. A mappában `npm install`, majd `npm start`. Böngésző: `http://localhost:3000`. Az internetes, két külön telefonos használathoz HTTPS-t és WebSocketet támogató publikus Node.js tárhely szükséges; a GitHub Pages önmagában nem elegendő. A szolgáltató ingyenes csomagja korlátozott lehet.

## Ellenőrzés
`node --check server.js` és `node test.mjs` – ellenőrzi a tábla topológiáját, a bank induló készletét és a kezdő építést. Ez nem teljes end-to-end vagy kéttelefonos teszt.

## Ismert hiányok
A speciális kétjátékos szabálymód nem teljes, a kikötők csak egy-egy csúcsra kerülnek, a térkép számai nem követik a hivatalos kiegyensúlyozott kiosztást, a játékállás memóriában van (újraindításkor elveszik), nincs valódi hálózati integrációs teszt, és az internetes tárhely még nincs beállítva. Nem tekinthető kész, hibamentes kiadásnak. A klasszikus mód is további szabálytesztet igényel.

A program saját prototípus, nem hivatalos Catan-termék. Nyilvános terjesztés előtt a szellemi tulajdonjogi kérdéseket ellenőrizni kell.

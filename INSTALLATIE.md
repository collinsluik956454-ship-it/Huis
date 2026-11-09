# Bankkoppeling installeren (ABN AMRO en ING)

Duur: ongeveer 20 minuten. Alles is gratis. Doe dit op een computer als je kunt, het kan ook op je telefoon.
De bankbrug is alleen-lezen: de app kan nooit geld overmaken.

## Deel 1: bankbrug op Cloudflare zetten
1. Maak een gratis account op https://dash.cloudflare.com
2. Ga naar **Workers & Pages → Create → Create Worker**. Geef hem de naam `huis-bank` en kies **Deploy**.
3. Kies **Edit code**, verwijder alles, plak de inhoud van `worker.js` en kies **Deploy**.
4. Noteer het adres van je worker, bijvoorbeeld `https://huis-bank.jouwnaam.workers.dev`.

## Deel 2: app registreren bij Enable Banking
1. Ga naar https://enablebanking.com/sign-in/ en log in met je e-mailadres (je krijgt een inloglink).
2. Kies **API applications → Register new application**.
   - Naam: Huis
   - Omgeving: **Production**
   - Sleutel: kies **Generate in the browser (using SubtleCrypto) and export private key**. Er wordt een `.pem`-bestand gedownload. Bewaar dat goed.
   - Redirect URL: `https://huis-bank.jouwnaam.workers.dev/callback` (jouw eigen adres plus `/callback`)
   - Gebruik: persoonlijk, voor je eigen huishouden.
3. Noteer de **Application ID** (een lange code met streepjes).
4. Kies bij je nieuwe app **Activate by linking accounts** en koppel daar je ABN AMRO-rekening.
   Charlotte moet haar eigen ING-rekening ook koppelen. Zij bevestigt dat in haar ING-app, dus doe dit samen.
   Zonder deze stap geeft Enable Banking geen gegevens vrij.

## Deel 3: geheimen in Cloudflare zetten
Ga naar je worker → **Settings → Variables and Secrets** en voeg toe (type **Secret**):
- `EB_APP_ID`: de Application ID uit deel 2
- `EB_KEY`: de volledige inhoud van het `.pem`-bestand, inclusief de BEGIN- en END-regels
- `HUIS_TOKEN`: een zelfverzonnen wachtwoord, bijvoorbeeld 20 willekeurige tekens
- `APP_URL` (mag ook als gewone Text): het adres van je Huis-app, bijvoorbeeld `https://collinsluik956454-ship-it.github.io/Huis/`

Kies daarna **Deploy**.

## Deel 4: in de Huis-app
1. Ga naar **Meer → Account & beheer → Bankkoppeling** (alleen de beheerder; Charlotte krijgt dit automatisch). Vul het worker-adres en het wachtwoord (`HUIS_TOKEN`) in. Kies **Opslaan** en dan **Testen**.
2. Ga naar **Budget → Bankkoppeling**, kies de bank en bij welk kopje het hoort (Gezamenlijk, Eigen Collin of Eigen Charlotte) en kies **Koppelen**.
3. Bevestig in je bank-app. Je komt op een pagina "Gekoppeld ✓".
   - In de browser kies je **Open Huis-app**.
   - In de Android-app kopieer je de bankcode en plak je die in de app bij **Bankcode plakken**.
4. Kies **Ophalen**. Je ziet eerst een lijstje om te controleren en bevestigt dan de import.

## Goed om te weten
- De toestemming bij de bank loopt na ongeveer 90 dagen af. De app laat zien hoeveel dagen er nog over zijn. Koppel dan opnieuw.
- Door nieuw ophalen ontstaan geen dubbele regels.
- Gebruik de koppeling alleen voor privérekeningen. Enable Banking staat dit gratis alleen toe voor persoonlijk gebruik.
- Als er een foutmelding komt, stuur die naar Claude. De naam van de bank kan bij Enable Banking afwijken en is dan makkelijk aan te passen.

---

## Account, beheerder en aanmelden (Firebase)

Eenmalig door Collin (de eerste gebruiker wordt beheerder):

1. Firebase-console → **Authentication** → *Aan de slag* → *Aanmeldmethode* → zet **E-mail/wachtwoord** aan. Onder *Instellingen → Gebruikersacties* moet **Aanmaken (aanmelden)** AAN staan.
2. **Projectinstellingen** (tandwiel) → *Algemeen* → kopieer de **Web API-sleutel**. Bij **Realtime Database** kopieer je de databaseURL.
3. Open de app → kies **Ik ben de beheerder** → plak databaseURL en Web API-sleutel → daarna **Aanmelden** met je gegevens → **Ik word beheerder**.
4. Als de app het vraagt: in de app onder **Meer → Account & beheer → Regels kopiëren**, en in Firebase → Realtime Database → *Regels* plakken en **Publiceren**.
5. Vul onder *Account & beheer* de bankbrug in (adres en wachtwoord). Alle goedgekeurde leden krijgen dit automatisch.
6. Kopieer de **uitnodigingslink** en stuur die naar Charlotte. Zij meldt zich aan, jij keurt haar goed onder *Aanvragen*.

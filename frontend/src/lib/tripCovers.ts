// src/lib/tripCovers.ts
import countriesCities from "../data/countriesCities.json";

type CountryCitiesEntry = { name: string; cities: string[] };

// map the *country name* to the cover filename you already have
// (the key should match the JSON country "name")
const COUNTRY_TO_COVER: Record<string, string> = {
  Australia: "australia.png",
  China: "china.jpg",
  France: "france.jpg",
  Indonesia: "indonesia.png",
  Italy: "italy.png",
  Japan: "japan.png",
  Korea: "korea.png",
  Malaysia: "malaysia.jpg",
  "New Zealand": "newzealand.png",
  Singapore: "singapore.jpg",
  "South Africa": "southafrica.jpg",
  Switzerland: "switzerland.jpg",
  Taiwan: "taiwan.jpg",
  Thailand: "thailand.jpg",
  USA: "usa.png",
  "United States": "usa.png",
  "United States of America": "usa.png",
};

// Unsplash images for countries without local covers
// All URLs from countryImageTop.txt (verified Unsplash URLs)
const EXTERNAL_COVERS: Record<string, string> = {
  // A
  Afghanistan: "https://www.rjtravelagency.com/wp-content/uploads/2023/07/Kabul-Afghanistan.jpg",
  "Aland Islands": "https://plus.unsplash.com/premium_photo-1669052824052-c6484a8214b3?w=640&h=400&fit=crop",
  Albania: "https://plus.unsplash.com/premium_photo-1697730104948-43575659bf0a?w=640&h=400&fit=crop",
  Algeria: "https://plus.unsplash.com/premium_photo-1697730020118-46dffe1c5b8c?w=640&h=400&fit=crop",
  "American Samoa": "https://plus.unsplash.com/premium_photo-1664121799894-eb6c2af13bc8?w=640&h=400&fit=crop",
  Andorra: "https://plus.unsplash.com/premium_photo-1670689708319-c542c6c79b33?w=640&h=400&fit=crop",
  Angola: "https://plus.unsplash.com/premium_photo-1670689708283-ae040a9cfde3?w=640&h=400&fit=crop",
  Anguilla: "https://plus.unsplash.com/premium_photo-1700566982898-595478087422?w=640&h=400&fit=crop",
  Antarctica: "https://plus.unsplash.com/premium_photo-1664304481949-7342698006f3?w=640&h=400&fit=crop",
  "Antigua and Barbuda": "https://plus.unsplash.com/premium_photo-1670689708295-286ff649e3ee?w=640&h=400&fit=crop",
  Argentina: "https://plus.unsplash.com/premium_photo-1697729901052-fe8900e24993?w=640&h=400&fit=crop",
  Armenia: "https://plus.unsplash.com/premium_photo-1661934402599-7cb20c105a7b?w=640&h=400&fit=crop",
  Aruba: "https://plus.unsplash.com/premium_photo-1691675468294-92cf425c58d1?w=640&h=400&fit=crop",
  Austria: "https://plus.unsplash.com/premium_photo-1690372792203-04e67de71e19?w=640&h=400&fit=crop",
  Azerbaijan: "https://images.travelandleisureasia.com/wp-content/uploads/sites/4/2024/02/21143137/feature-2024-02-20t103400-420.jpeg?tr=w-1366,f-jpg,pr-true",
  // B
  Bahrain: "https://plus.unsplash.com/premium_photo-1697730197947-f19e92f0035b?w=640&h=400&fit=crop",
  Bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=640&h=400&fit=crop",
  Bangladesh: "https://plus.unsplash.com/premium_photo-1670782711957-66efb3bb1479?w=640&h=400&fit=crop",
  Barbados: "https://plus.unsplash.com/premium_photo-1663011528178-8784c8f6d767?w=640&h=400&fit=crop",
  Belarus: "https://plus.unsplash.com/premium_photo-1727431326723-48798fbc277a?w=640&h=400&fit=crop",
  Belgium: "https://plus.unsplash.com/premium_photo-1661886882389-e99d9a5299c0?w=640&h=400&fit=crop",
  Belize: "https://plus.unsplash.com/premium_photo-1664304455335-602b6811149a?w=640&h=400&fit=crop",
  Benin: "https://plus.unsplash.com/premium_photo-1670689708270-0c2306b00a4e?w=640&h=400&fit=crop",
  Bermuda: "https://plus.unsplash.com/premium_photo-1691642677828-4e1791bd39b2?w=640&h=400&fit=crop",
  Bhutan: "https://plus.unsplash.com/premium_photo-1661952578770-79010299a9f9?w=640&h=400&fit=crop",
  Bolivia: "https://plus.unsplash.com/premium_photo-1721033489069-c648c111f5f5?w=640&h=400&fit=crop",
  "Bonaire, Sint Eustatius and Saba": "https://images.unsplash.com/photo-1519676241691-fe10cb097ae5?w=640&h=400&fit=crop",
  "Bosnia and Herzegovina": "https://plus.unsplash.com/premium_photo-1669839774775-a2735e880a77?w=640&h=400&fit=crop",
  Botswana: "https://plus.unsplash.com/premium_photo-1661952476300-1f32e068126f?w=640&h=400&fit=crop",
  "Bouvet Island": "https://plus.unsplash.com/premium_photo-1668883188879-3a7acd2bec58?w=640&h=400&fit=crop",
  Brazil: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=640&h=400&fit=crop",
  "British Indian Ocean Territory": "https://plus.unsplash.com/premium_photo-1669472887819-ce979268ae9b?w=640&h=400&fit=crop",
  Brunei: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Sultan_Omar_Ali_Saifuddin_Mosque_02.jpg/640px-Sultan_Omar_Ali_Saifuddin_Mosque_02.jpg",
  Bulgaria: "https://plus.unsplash.com/premium_photo-1677620678919-610361b77a2e?w=640&h=400&fit=crop",
  "Burkina Faso": "https://plus.unsplash.com/premium_photo-1670689708266-04103f3f2f69?w=640&h=400&fit=crop",
  Burundi: "https://plus.unsplash.com/premium_photo-1670998952947-6cc069d9b76f?w=640&h=400&fit=crop",
  // C
  Cambodia: "https://plus.unsplash.com/premium_photo-1661963188432-5de8a11f21a7?w=640&h=400&fit=crop",
  Cameroon: "https://plus.unsplash.com/premium_photo-1670689708221-d6ad523bb9a2?w=640&h=400&fit=crop",
  Canada: "https://plus.unsplash.com/premium_photo-1694475393287-88027e0fbde4?w=640&h=400&fit=crop",
  "Cape Verde": "https://plus.unsplash.com/premium_photo-1670782711884-7e3a709b6450?w=640&h=400&fit=crop",
  "Cayman Islands": "https://plus.unsplash.com/premium_photo-1680339680335-7e3b8572fc00?w=640&h=400&fit=crop",
  "Central African Republic": "https://plus.unsplash.com/premium_photo-1661832611972-b6ee1aba3581?w=640&h=400&fit=crop",
  Chad: "https://plus.unsplash.com/premium_photo-1670689707818-58c81856b5cf?w=640&h=400&fit=crop",
  Chile: "https://plus.unsplash.com/premium_photo-1670689708206-4e2f96967b40?w=640&h=400&fit=crop",
  "Christmas Island": "https://plus.unsplash.com/premium_photo-1697730548707-1a7c8e67e7e0?w=640&h=400&fit=crop",
  "Cocos (Keeling) Islands": "https://plus.unsplash.com/premium_photo-1681839699894-b42c91a2eea2?w=640&h=400&fit=crop",
  Colombia: "https://plus.unsplash.com/premium_photo-1697730230838-ed66c50c4c9a?w=640&h=400&fit=crop",
  Comoros: "https://plus.unsplash.com/premium_photo-1670782712076-a952887ec7fe?w=640&h=400&fit=crop",
  Congo: "https://plus.unsplash.com/premium_photo-1670782711962-f59010a90b87?w=640&h=400&fit=crop",
  "Cook Islands": "https://plus.unsplash.com/premium_photo-1661885413762-341e689bd8a3?w=640&h=400&fit=crop",
  "Costa Rica": "https://plus.unsplash.com/premium_photo-1687428554373-216355fb6929?w=640&h=400&fit=crop",
  Croatia: "https://plus.unsplash.com/premium_photo-1661960492445-a2409ba481b7?w=640&h=400&fit=crop",
  Cuba: "https://plus.unsplash.com/premium_photo-1682125792755-40f2c999e884?w=640&h=400&fit=crop",
  Curaçao: "https://plus.unsplash.com/premium_photo-1733259771911-f76d15695baf?w=640&h=400&fit=crop",
  Cyprus: "https://plus.unsplash.com/premium_photo-1697729899721-1ee7e8d76cdc?w=640&h=400&fit=crop",
  "Czech Republic": "https://plus.unsplash.com/premium_photo-1661963139522-22525f644234?w=640&h=400&fit=crop",
  Czechia: "https://plus.unsplash.com/premium_photo-1661963139522-22525f644234?w=640&h=400&fit=crop",
  // D
  "Democratic Republic of the Congo": "https://plus.unsplash.com/premium_photo-1670782711962-f59010a90b87?w=640&h=400&fit=crop",
  Denmark: "https://plus.unsplash.com/premium_photo-1689274023938-d6fb03d26d29?w=640&h=400&fit=crop",
  Djibouti: "https://plus.unsplash.com/premium_photo-1733259774864-ee718f86b9b2?w=640&h=400&fit=crop",
  Dominica: "https://plus.unsplash.com/premium_photo-1661962432490-6188a6420a81?w=640&h=400&fit=crop",
  "Dominican Republic": "https://plus.unsplash.com/premium_photo-1670689708155-6841be26db33?w=640&h=400&fit=crop",
  // E
  Ecuador: "https://plus.unsplash.com/premium_photo-1670689708157-4fbe24ff50f6?w=640&h=400&fit=crop",
  Egypt: "https://plus.unsplash.com/premium_photo-1661891622579-bee76e28c304?w=640&h=400&fit=crop",
  "El Salvador": "https://plus.unsplash.com/premium_photo-1670782711992-5d04a41c18aa?w=640&h=400&fit=crop",
  "Equatorial Guinea": "https://plus.unsplash.com/premium_photo-1730078556492-8288792f35d5?w=640&h=400&fit=crop",
  Eritrea: "https://plus.unsplash.com/premium_photo-1694475008338-2e833efd8ac9?w=640&h=400&fit=crop",
  Estonia: "https://plus.unsplash.com/premium_photo-1670689708118-199a9669283a?w=640&h=400&fit=crop",
  Eswatini: "https://plus.unsplash.com/premium_photo-1670689708135-a432147c0c1b?w=640&h=400&fit=crop",
  Ethiopia: "https://plus.unsplash.com/premium_photo-1695297515151-b2af3a60008d?w=640&h=400&fit=crop",
  // F
  "Falkland Islands": "https://plus.unsplash.com/premium_photo-1669661169386-c2ca640bfafe?w=640&h=400&fit=crop",
  "Faroe Islands": "https://plus.unsplash.com/premium_photo-1677653128370-30c017f0b636?w=640&h=400&fit=crop",
  Fiji: "https://plus.unsplash.com/premium_photo-1719843013775-1a101dd75b37?w=640&h=400&fit=crop",
  "Fiji Islands": "https://plus.unsplash.com/premium_photo-1719843013775-1a101dd75b37?w=640&h=400&fit=crop",
  Finland: "https://images.travelandleisureasia.com/wp-content/uploads/sites/5/2025/09/04115639/helsinki-fi.jpeg?tr=w-1200,q-60",
  France: "https://plus.unsplash.com/premium_photo-1661956135713-f93a5a95904d?w=640&h=400&fit=crop",
  "French Guiana": "https://plus.unsplash.com/premium_photo-1730160763831-28093a52d039?w=640&h=400&fit=crop",
  "French Polynesia": "https://plus.unsplash.com/premium_photo-1666286163385-abe05f0326c4?w=640&h=400&fit=crop",
  "French Southern Territories": "https://plus.unsplash.com/premium_photo-1668883188917-761f35942220?w=640&h=400&fit=crop",
  // G
  Gabon: "https://plus.unsplash.com/premium_photo-1670689708136-2dd47ebdf7ce?w=640&h=400&fit=crop",
  Georgia: "https://plus.unsplash.com/premium_photo-1697729751156-68f01255334c?w=640&h=400&fit=crop",
  Germany: "https://plus.unsplash.com/premium_photo-1661962435210-e6cdbb2cbeb4?w=640&h=400&fit=crop",
  Ghana: "https://plus.unsplash.com/premium_photo-1670689708109-10ab7bdff803?w=640&h=400&fit=crop",
  Gibraltar: "https://plus.unsplash.com/premium_photo-1661963888813-860f4d949f7f?w=640&h=400&fit=crop",
  Greece: "https://plus.unsplash.com/premium_photo-1661964149725-fbf14eabd38c?w=640&h=400&fit=crop",
  Greenland: "https://plus.unsplash.com/premium_photo-1667997886539-77d6e47f5672?w=640&h=400&fit=crop",
  Grenada: "https://plus.unsplash.com/premium_photo-1670782711880-815b2c7317e7?w=640&h=400&fit=crop",
  Guadeloupe: "https://plus.unsplash.com/premium_photo-1681582960531-7b5de57fb276?w=640&h=400&fit=crop",
  Guam: "https://plus.unsplash.com/premium_photo-1664640458482-23df72d8b882?w=640&h=400&fit=crop",
  Guatemala: "https://plus.unsplash.com/premium_photo-1697730089767-45e915ef27f9?w=640&h=400&fit=crop",
  Guernsey: "https://plus.unsplash.com/premium_photo-1723802627333-84dd17e016eb?w=640&h=400&fit=crop",
  Guinea: "https://plus.unsplash.com/premium_photo-1670689708100-b55a833b3214?w=640&h=400&fit=crop",
  "Guinea-Bissau": "https://plus.unsplash.com/premium_photo-1670552850949-8ece0f504005?w=640&h=400&fit=crop",
  Guyana: "https://plus.unsplash.com/premium_photo-1670782711877-6bfc379257df?w=640&h=400&fit=crop",
  // H
  Haiti: "https://plus.unsplash.com/premium_photo-1670782711866-76a5ebb2b42c?w=640&h=400&fit=crop",
  Honduras: "https://plus.unsplash.com/premium_photo-1670552851032-f9e71cc8075a?w=640&h=400&fit=crop",
  "Hong Kong": "https://plus.unsplash.com/premium_photo-1694475241684-d16165455e73?w=640&h=400&fit=crop",
  "Hong Kong S.A.R.": "https://plus.unsplash.com/premium_photo-1694475241684-d16165455e73?w=640&h=400&fit=crop",
  Hungary: "https://plus.unsplash.com/premium_photo-1680721310331-7c5bea03392d?w=640&h=400&fit=crop",
  // I
  Iceland: "https://plus.unsplash.com/premium_photo-1674583546207-3a7a9c98baa9?w=640&h=400&fit=crop",
  India: "https://plus.unsplash.com/premium_photo-1661919589683-f11880119fb7?w=640&h=400&fit=crop",
  Iran: "https://plus.unsplash.com/premium_photo-1701172277688-32d05010526a?w=640&h=400&fit=crop",
  Iraq: "https://plus.unsplash.com/premium_photo-1670689708100-838444c7bb8a?w=640&h=400&fit=crop",
  Ireland: "https://plus.unsplash.com/premium_photo-1697729870676-85a2eee0c593?w=640&h=400&fit=crop",
  Israel: "https://upload.wikimedia.org/wikipedia/commons/a/a3/ISR-2013-Aerial-Jaffa-Port_of_Jaffa.jpg",
  Italy: "https://plus.unsplash.com/premium_photo-1675975678457-d70708bf77c8?w=640&h=400&fit=crop",
  "Ivory Coast": "https://plus.unsplash.com/premium_photo-1670689708220-78742d3369b3?w=640&h=400&fit=crop",
  // J
  Jamaica: "https://plus.unsplash.com/premium_photo-1661962432490-6188a6420a81?w=640&h=400&fit=crop",
  Japan: "https://plus.unsplash.com/premium_photo-1661964177687-57387c2cbd14?w=640&h=400&fit=crop",
  Jersey: "https://plus.unsplash.com/premium_photo-1665673313491-22509937fc9f?w=640&h=400&fit=crop",
  Jordan: "https://plus.unsplash.com/premium_photo-1674657644778-1c9f03fd1e55?w=640&h=400&fit=crop",
  // K
  Kazakhstan: "https://plus.unsplash.com/premium_photo-1697730150003-26a1d469adb4?w=640&h=400&fit=crop",
  Kenya: "https://plus.unsplash.com/premium_photo-1664304370557-233bccc0ac85?w=640&h=400&fit=crop",
  Kiribati: "https://plus.unsplash.com/premium_photo-1670782711822-9e7777e54204?w=640&h=400&fit=crop",
  Kosovo: "https://plus.unsplash.com/premium_photo-1669047983472-1eeb3a5ea6a5?w=640&h=400&fit=crop",
  Kuwait: "https://plus.unsplash.com/premium_photo-1694475218266-b93569487419?w=640&h=400&fit=crop",
  Kyrgyzstan: "https://plus.unsplash.com/premium_photo-1697730150003-26a1d469adb4?w=640&h=400&fit=crop",
  // L
  Laos: "https://plus.unsplash.com/premium_photo-1661916287718-edb15703cbaf?w=640&h=400&fit=crop",
  Latvia: "https://plus.unsplash.com/premium_photo-1665311514176-9f479c3d3da4?w=640&h=400&fit=crop",
  Lebanon: "https://plus.unsplash.com/premium_photo-1670689708633-382cbca7118a?w=640&h=400&fit=crop",
  Lesotho: "https://plus.unsplash.com/premium_photo-1670689708042-0f3b59669298?w=640&h=400&fit=crop",
  Liberia: "https://plus.unsplash.com/premium_photo-1670782711844-db287cbdce41?w=640&h=400&fit=crop",
  Libya: "https://plus.unsplash.com/premium_photo-1699535657712-02fe404e916f?w=640&h=400&fit=crop",
  Liechtenstein: "https://plus.unsplash.com/premium_photo-1670782711875-49d73bf34b18?w=640&h=400&fit=crop",
  Lithuania: "https://plus.unsplash.com/premium_photo-1670782711881-fa098196baa6?w=640&h=400&fit=crop",
  Luxembourg: "https://plus.unsplash.com/premium_photo-1674680852989-7775de3a63cc?w=640&h=400&fit=crop",
  // M
  Macao: "https://images.unsplash.com/photo-1585060418971-26baa42fcd25?w=640&h=400&fit=crop",
  Macau: "https://images.unsplash.com/photo-1585060418971-26baa42fcd25?w=640&h=400&fit=crop",
  "Macau S.A.R.": "https://images.unsplash.com/photo-1585060418971-26baa42fcd25?w=640&h=400&fit=crop",
  Madagascar: "https://plus.unsplash.com/premium_photo-1666721922432-49f64a5db919?w=640&h=400&fit=crop",
  Malawi: "https://plus.unsplash.com/premium_photo-1664303575598-026ebb947a96?w=640&h=400&fit=crop",
  Maldives: "https://plus.unsplash.com/premium_photo-1666432045848-3fdbb2c74531?w=640&h=400&fit=crop",
  Mali: "https://plus.unsplash.com/premium_photo-1733493684048-7dbae9f32e38?w=640&h=400&fit=crop",
  Malta: "https://plus.unsplash.com/premium_photo-1715293871539-fc52462c38dd?w=640&h=400&fit=crop",
  "Man (Isle of)": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Castletown%2C_Isle_of_Man%2C_2006_%2802%29.jpg/640px-Castletown%2C_Isle_of_Man%2C_2006_%2802%29.jpg",
  "Marshall Islands": "https://plus.unsplash.com/premium_photo-1701091825802-ce3d34edf8e1?w=640&h=400&fit=crop",
  Martinique: "https://plus.unsplash.com/premium_photo-1664304458186-9a67c1330d02?w=640&h=400&fit=crop",
  Mauritania: "https://plus.unsplash.com/premium_photo-1699535657712-02fe404e916f?w=640&h=400&fit=crop",
  Mauritius: "https://plus.unsplash.com/premium_photo-1719843013722-c2f4d69db940?w=640&h=400&fit=crop",
  Mayotte: "https://plus.unsplash.com/premium_photo-1664121799894-eb6c2af13bc8?w=640&h=400&fit=crop",
  Mexico: "https://plus.unsplash.com/premium_photo-1676517032044-5d602374a95b?w=640&h=400&fit=crop",
  Micronesia: "https://plus.unsplash.com/premium_photo-1719843013775-1a101dd75b37?w=640&h=400&fit=crop",
  Moldova: "https://plus.unsplash.com/premium_photo-1663947578336-1a45da837985?w=640&h=400&fit=crop",
  Monaco: "https://plus.unsplash.com/premium_photo-1661963053870-2f2cf49e7989?w=640&h=400&fit=crop",
  Mongolia: "https://plus.unsplash.com/premium_photo-1692895424097-a195cfa8a0c6?w=640&h=400&fit=crop",
  Montenegro: "https://plus.unsplash.com/premium_photo-1683120761973-d0bc2776a6ac?w=640&h=400&fit=crop",
  Montserrat: "https://plus.unsplash.com/premium_photo-1694475029709-166594c0af59?w=640&h=400&fit=crop",
  Morocco: "https://plus.unsplash.com/premium_photo-1673415819362-c2ca640bfafe?w=640&h=400&fit=crop",
  Mozambique: "https://plus.unsplash.com/premium_photo-1671358446946-8bd43ba08a6a?w=640&h=400&fit=crop",
  Myanmar: "https://plus.unsplash.com/premium_photo-1664303315354-348fb90f633f?w=640&h=400&fit=crop",
  // N
  Namibia: "https://plus.unsplash.com/premium_photo-1675705698856-4e15ed5506d6?w=640&h=400&fit=crop",
  Nauru: "https://plus.unsplash.com/premium_photo-1669472887819-ce979268ae9b?w=640&h=400&fit=crop",
  Nepal: "https://plus.unsplash.com/premium_photo-1688645554172-d3aef5f837ce?w=640&h=400&fit=crop",
  Netherlands: "https://plus.unsplash.com/premium_photo-1661964194420-d1237f0b7bd8?w=640&h=400&fit=crop",
  "New Caledonia": "https://plus.unsplash.com/premium_photo-1663047570442-c388462267b6?w=640&h=400&fit=crop",
  Nicaragua: "https://plus.unsplash.com/premium_photo-1677636665180-93b4b0e22b99?w=640&h=400&fit=crop",
  Niger: "https://plus.unsplash.com/premium_photo-1670855108625-d841a8a717ec?w=640&h=400&fit=crop",
  Nigeria: "https://plus.unsplash.com/premium_photo-1675865395171-4152ba93d11c?w=640&h=400&fit=crop",
  Niue: "https://plus.unsplash.com/premium_photo-1673240159015-e0ced88df98c?w=640&h=400&fit=crop",
  "Norfolk Island": "https://plus.unsplash.com/premium_photo-1690552679183-87f6b74dc4c1?w=640&h=400&fit=crop",
  "North Korea": "https://plus.unsplash.com/premium_photo-1670552850940-0f9932fb3d6a?w=640&h=400&fit=crop",
  "North Macedonia": "https://plus.unsplash.com/premium_photo-1661957610869-668a3773055a?w=640&h=400&fit=crop",
  "Northern Mariana Islands": "https://plus.unsplash.com/premium_photo-1663950432509-825474fae8a6?w=640&h=400&fit=crop",
  Norway: "https://plus.unsplash.com/premium_photo-1668017178993-4c8fc9f59872?w=640&h=400&fit=crop",
  // O
  Oman: "https://plus.unsplash.com/premium_photo-1674156433236-2338418ec4d9?w=640&h=400&fit=crop",
  // P
  Pakistan: "https://plus.unsplash.com/premium_photo-1697729758639-d692c36557b2?w=640&h=400&fit=crop",
  Palau: "https://plus.unsplash.com/premium_photo-1661833157397-d8ee0e10675c?w=640&h=400&fit=crop",
  Panama: "https://plus.unsplash.com/premium_photo-1670689707808-980c08599060?w=640&h=400&fit=crop",
  "Papua New Guinea": "https://plus.unsplash.com/premium_photo-1712736395839-997c8c9dbd06?w=640&h=400&fit=crop",
  Paraguay: "https://plus.unsplash.com/premium_photo-1670998953029-5022e8eb8d9e?w=640&h=400&fit=crop",
  Peru: "https://plus.unsplash.com/premium_photo-1694542947673-9e1c61387343?w=640&h=400&fit=crop",
  Philippines: "https://upload.wikimedia.org/wikipedia/commons/b/b8/Limestone_island_in_Bacuit_Bay%2C_El_Nido%2C_Palawan%2C_Philippines.jpg",
  "Pitcairn Island": "https://plus.unsplash.com/premium_photo-1668883188917-761f35942220?w=640&h=400&fit=crop",
  Poland: "https://plus.unsplash.com/premium_photo-1689248943653-37ab70151a9f?w=640&h=400&fit=crop",
  Portugal: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=640&h=400&fit=crop",
  "Puerto Rico": "https://plus.unsplash.com/premium_photo-1661962694871-5422f8c4c506?w=640&h=400&fit=crop",
  // Q
  Qatar: "https://upload.wikimedia.org/wikipedia/commons/8/8d/IslamicArtMuseumDohaSkyline.jpg",
  // R
  Reunion: "https://plus.unsplash.com/premium_photo-1661503228332-03778ab6d6a1?w=640&h=400&fit=crop",
  Romania: "https://plus.unsplash.com/premium_photo-1670689708401-64550ff2461c?w=640&h=400&fit=crop",
  Russia: "https://plus.unsplash.com/premium_photo-1661964173407-af6b43f880df?w=640&h=400&fit=crop",
  Rwanda: "https://plus.unsplash.com/premium_photo-1670689707787-ac9a9dd082e2?w=640&h=400&fit=crop",
  // S
  "Saint Helena": "https://plus.unsplash.com/premium_photo-1678052317092-85dea06ae311?w=640&h=400&fit=crop",
  "Saint Kitts and Nevis": "https://plus.unsplash.com/premium_photo-1670689707782-cdb3e0318d26?w=640&h=400&fit=crop",
  "Saint Lucia": "https://plus.unsplash.com/premium_photo-1661962432490-6188a6420a81?w=640&h=400&fit=crop",
  "Saint Pierre and Miquelon": "https://plus.unsplash.com/premium_photo-1688071660160-271368a8f8c3?w=640&h=400&fit=crop",
  "Saint Vincent and the Grenadines": "https://plus.unsplash.com/premium_photo-1678230042085-826c5e8e140a?w=640&h=400&fit=crop",
  "Saint-Barthelemy": "https://images.unsplash.com/photo-1733430528972-ec648163783e?w=640&h=400&fit=crop",
  Samoa: "https://plus.unsplash.com/premium_photo-1664304448943-e1a547175c22?w=640&h=400&fit=crop",
  "San Marino": "https://plus.unsplash.com/premium_photo-1670855108632-bd3584bf7031?w=640&h=400&fit=crop",
  "Sao Tome and Principe": "https://plus.unsplash.com/premium_photo-1675433766262-931ac3ad0525?w=640&h=400&fit=crop",
  "Saudi Arabia": "https://plus.unsplash.com/premium_photo-1670689707632-fe0edeedde02?w=640&h=400&fit=crop",
  Scotland: "https://commons.wikimedia.org/wiki/Commons:Wiki_Loves_Earth_2025_in_Scotland#/media/File:Loch_Morlich_in_Scotland.jpg",
  Senegal: "https://plus.unsplash.com/premium_photo-1670689707776-6c0b0f74283e?w=640&h=400&fit=crop",
  Serbia: "https://plus.unsplash.com/premium_photo-1719850361381-818ef284c990?w=640&h=400&fit=crop",
  Seychelles: "https://plus.unsplash.com/premium_photo-1681582959812-b65dd91759f4?w=640&h=400&fit=crop",
  "Sierra Leone": "https://plus.unsplash.com/premium_photo-1670689707768-9fce08c1a10a?w=640&h=400&fit=crop",
  Singapore: "https://plus.unsplash.com/premium_photo-1697730373939-3ebcaa9d295e?w=640&h=400&fit=crop",
  "Sint Maarten (Dutch part)": "https://images.unsplash.com/photo-1678445100397-7dab093d588b?w=640&h=400&fit=crop",
  Slovakia: "https://plus.unsplash.com/premium_photo-1670689707764-83ba13b734ab?w=640&h=400&fit=crop",
  Slovenia: "https://plus.unsplash.com/premium_photo-1668242385331-a6ab3586d53b?w=640&h=400&fit=crop",
  "Solomon Islands": "https://plus.unsplash.com/premium_photo-1669052824052-c6484a8214b3?w=640&h=400&fit=crop",
  Somalia: "https://plus.unsplash.com/premium_photo-1699535657712-02fe404e916f?w=640&h=400&fit=crop",
  "South Africa": "https://plus.unsplash.com/premium_photo-1697730061063-ad499e343f26?w=640&h=400&fit=crop",
  "South Georgia": "https://plus.unsplash.com/premium_photo-1664303218668-03fa4e612038?w=640&h=400&fit=crop",
  "South Korea": "https://plus.unsplash.com/premium_photo-1661963468634-71b9482a3efe?w=640&h=400&fit=crop",
  "South Sudan": "https://plus.unsplash.com/premium_photo-1699699368327-a1887e5a6ce6?w=640&h=400&fit=crop",
  Spain: "https://plus.unsplash.com/premium_photo-1716138192476-f34e85ad43c2?w=640&h=400&fit=crop",
  "Sri Lanka": "https://plus.unsplash.com/premium_photo-1730145749791-28fc538d7203?w=640&h=400&fit=crop",
  Sudan: "https://plus.unsplash.com/premium_photo-1699535657712-02fe404e916f?w=640&h=400&fit=crop",
  Suriname: "https://plus.unsplash.com/premium_photo-1670689707713-d6f9e1dc9a52?w=640&h=400&fit=crop",
  "Svalbard and Jan Mayen Islands": "https://images.unsplash.com/photo-1705534314499-3e197e5367be?w=640&h=400&fit=crop",
  Sweden: "https://images.unsplash.com/photo-1509356843151-3e7d96241e11?w=640&h=400&fit=crop",
  Switzerland: "https://plus.unsplash.com/premium_photo-1689805586474-e59c51f38254?w=640&h=400&fit=crop",
  Syria: "https://plus.unsplash.com/premium_photo-1697729983853-73d61f1c446f?w=640&h=400&fit=crop",
  // T
  Taiwan: "https://plus.unsplash.com/premium_photo-1661951189203-12decb9d7f8e?w=640&h=400&fit=crop",
  Tajikistan: "https://plus.unsplash.com/premium_photo-1697730150003-26a1d469adb4?w=640&h=400&fit=crop",
  Tanzania: "https://plus.unsplash.com/premium_photo-1661936361131-c421746dcd0d?w=640&h=400&fit=crop",
  Thailand: "https://plus.unsplash.com/premium_photo-1661962958462-9e52fda9954d?w=640&h=400&fit=crop",
  "The Bahamas": "https://plus.unsplash.com/premium_photo-1681223447351-eb381f9c3533?w=640&h=400&fit=crop",
  "The Gambia": "https://plus.unsplash.com/premium_photo-1670689708127-59a8b7d7259e?w=640&h=400&fit=crop",
  "Timor-Leste": "https://plus.unsplash.com/premium_photo-1675433766509-a74071ee618a?w=640&h=400&fit=crop",
  Togo: "https://plus.unsplash.com/premium_photo-1670782711918-1c9b95456dcb?w=640&h=400&fit=crop",
  Tokelau: "https://plus.unsplash.com/premium_photo-1664283661426-c0daf3c67c6d?w=640&h=400&fit=crop",
  Tonga: "https://plus.unsplash.com/premium_photo-1733306474431-812ecf195865?w=640&h=400&fit=crop",
  "Trinidad and Tobago": "https://plus.unsplash.com/premium_photo-1670782711857-a0dba254471f?w=640&h=400&fit=crop",
  Tunisia: "https://plus.unsplash.com/premium_photo-1670689707677-ff4510497b87?w=640&h=400&fit=crop",
  Turkey: "https://plus.unsplash.com/premium_photo-1661963652315-d5a9d26637dd?w=640&h=400&fit=crop",
  Turkmenistan: "https://plus.unsplash.com/premium_photo-1697730009726-4ddf244ff653?w=640&h=400&fit=crop",
  "Turks and Caicos Islands": "https://plus.unsplash.com/premium_photo-1708433275711-2054fdb615f9?w=640&h=400&fit=crop",
  Tuvalu: "https://plus.unsplash.com/premium_photo-1701091825802-ce3d34edf8e1?w=640&h=400&fit=crop",
  // U
  Uganda: "https://plus.unsplash.com/premium_photo-1661876679866-dcad0b7d0742?w=640&h=400&fit=crop",
  Ukraine: "https://plus.unsplash.com/premium_photo-1679386297855-cbbc5d3e1dfa?w=640&h=400&fit=crop",
  UAE: "https://plus.unsplash.com/premium_photo-1697729798591-8b7e1b271515?w=640&h=400&fit=crop",
  "United Arab Emirates": "https://plus.unsplash.com/premium_photo-1697729798591-8b7e1b271515?w=640&h=400&fit=crop",
  UK: "https://plus.unsplash.com/premium_photo-1661962726504-fa8f464a1bb8?w=640&h=400&fit=crop",
  "United Kingdom": "https://plus.unsplash.com/premium_photo-1661962726504-fa8f464a1bb8?w=640&h=400&fit=crop",
  "United States": "https://plus.unsplash.com/premium_photo-1681803531285-75db948035d3?w=640&h=400&fit=crop",
  "United States Minor Outlying Islands": "https://plus.unsplash.com/premium_photo-1669052824052-c6484a8214b3?w=640&h=400&fit=crop",
  Uruguay: "https://plus.unsplash.com/premium_photo-1670855108652-24dcc291389e?w=640&h=400&fit=crop",
  Uzbekistan: "https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/159F7/production/_130876588_gettyimages-638640833.jpg",
  // V
  Vanuatu: "https://plus.unsplash.com/premium_photo-1664304458186-9a67c1330d02?w=640&h=400&fit=crop",
  "Vatican City State (Holy See)": "https://plus.unsplash.com/premium_photo-1694475372253-ba08f23e8557?w=640&h=400&fit=crop",
  Venezuela: "https://plus.unsplash.com/premium_photo-1670689707683-d773aa2e5793?w=640&h=400&fit=crop",
  Vietnam: "https://plus.unsplash.com/premium_photo-1719955783083-6a0bd66c5f75?w=640&h=400&fit=crop",
  "Virgin Islands (British)": "https://plus.unsplash.com/premium_photo-1680815065140-0adb64cadeb5?w=640&h=400&fit=crop",
  "Virgin Islands (US)": "https://images.unsplash.com/photo-1678892122936-c7affc7f257f?w=640&h=400&fit=crop",
  // W
  "Western Sahara": "https://plus.unsplash.com/premium_photo-1699534404114-43e162f927fb?w=640&h=400&fit=crop",
  // Y
  Yemen: "https://plus.unsplash.com/premium_photo-1674156433236-2338418ec4d9?w=640&h=400&fit=crop",
  // Z
  Zambia: "https://plus.unsplash.com/premium_photo-1661831799042-ecb556000177?w=640&h=400&fit=crop",
  Zimbabwe: "https://plus.unsplash.com/premium_photo-1661817083646-cf3a6f24f040?w=640&h=400&fit=crop",
};

function normalize(s: string) {
  return (s || "").trim().toLowerCase();
}

/**
 * Returns a stable cover image path based on the trip's country.
 * - If country matches a known local image: /trip-covers/<filename>
 * - Else if country matches an external image: Unsplash URL
 * - Else: /trip-covers/default.jpg
 */
export function pickTripCover(countryName?: string | null) {
  const data = countriesCities as CountryCitiesEntry[];

  const input = (countryName || "").trim();
  if (!input) return "/trip-covers/default.jpg";

  // Try exact match against JSON name (case-insensitive)
  const match = data.find((c) => normalize(c.name) === normalize(input));
  const canonical = match?.name || input;

  // 1. Check local covers first
  const filename = COUNTRY_TO_COVER[canonical];
  if (filename) return `/trip-covers/${filename}`;

  // Try "best effort" contains match for local
  const foundKey = Object.keys(COUNTRY_TO_COVER).find(
    (k) =>
      normalize(canonical) === normalize(k) ||
      normalize(canonical).includes(normalize(k))
  );
  if (foundKey) return `/trip-covers/${COUNTRY_TO_COVER[foundKey]}`;

  // 2. Check external covers
  const extExact = EXTERNAL_COVERS[canonical];
  if (extExact) return extExact;

  // Try case-insensitive match for external
  const extKey = Object.keys(EXTERNAL_COVERS).find(
    (k) => normalize(k) === normalize(canonical)
  );
  if (extKey) return EXTERNAL_COVERS[extKey];

  // Try partial match for external
  const extPartial = Object.keys(EXTERNAL_COVERS).find(
    (k) =>
      normalize(canonical).includes(normalize(k)) ||
      normalize(k).includes(normalize(canonical))
  );
  if (extPartial) return EXTERNAL_COVERS[extPartial];

  return "/trip-covers/default.jpg";
}

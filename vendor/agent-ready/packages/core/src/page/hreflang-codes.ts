// Valid hreflang values as Google reads them (HreflangCodes.kt): `x-default`, or an ISO 639-1
// language, optionally with an ISO 15924 script and an ISO 3166-1 alpha-2 region (`en`, `en-GB`,
// `zh-Hant-TW`). `en-UK` is invalid: UK is no region. The lists are Java's
// Locale.getISOLanguages() and getISOCountries(), so a code passes here exactly when it passes in
// WorkPods.

const LANGUAGES = new Set(
  (
    'aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu ' +
    'cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ' +
    'ho hr ht hu hy hz ia id ie ig ii ik in io is it iu iw ja ji jv ka kg ki kj kk kl km kn ' +
    'ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mo mr ms mt my na nb ' +
    'nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se ' +
    'sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug ' +
    'uk ur uz ve vi vo wa wo xh yi yo za zh zu'
  ).split(' '),
)

const REGIONS = new Set(
  (
    'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO ' +
    'BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ ' +
    'DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP ' +
    'GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG ' +
    'KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML ' +
    'MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE ' +
    'PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL ' +
    'SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM ' +
    'US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
  ).split(' '),
)

const SCRIPT = /^[A-Za-z]{4}$/

export function validHreflang(code: string): boolean {
  if (code.toLowerCase() === 'x-default') return true
  const [language = '', ...rest] = code.split('-')
  if (!LANGUAGES.has(language.toLowerCase())) return false
  const [first = '', second = ''] = rest
  if (rest.length === 0) return true
  if (rest.length === 1) return SCRIPT.test(first) || REGIONS.has(first.toUpperCase())
  return rest.length === 2 && SCRIPT.test(first) && REGIONS.has(second.toUpperCase())
}

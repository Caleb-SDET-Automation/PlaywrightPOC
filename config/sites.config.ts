/**
 * Sites Configuration
 * Defines all 80+ monitored setups.
 * Add/remove entries freely — the orchestrator reads this at runtime.
 */

export interface SiteConfig {
  id: string;
  name: string;
  group: string;
  region: string;
  erp: {
    baseUrl: string;
    username: string;
    password: string;
    tenant?: string;
  };
  middleware: {
    baseUrl: string;
    apiKey?: string;
    healthEndpoint: string;
  };
  ssrs: {
    baseUrl: string;
    username: string;
    password: string;
    invoiceReport: string;
  };
  checkmk: {
    hostName: string;
  };
  tags?: string[];
  enabled: boolean;
}

/**
 * Helper to create a site entry using shared credentials overridden per site.
 * In production replace placeholder values from your secrets vault / env-per-site files.
 */
function site(
  id: string,
  name: string,
  group: string,
  region: string,
  erpBase: string,
  mwBase: string,
  ssrsBase: string,
  tags: string[] = [],
): SiteConfig {
  return {
    id,
    name,
    group,
    region,
    erp: {
      baseUrl: erpBase,
      username: process.env[`${id.toUpperCase().replace(/-/g, '_')}_ERP_USER`] || process.env.ERP_USERNAME || 'monitor_user',
      password: process.env[`${id.toUpperCase().replace(/-/g, '_')}_ERP_PASS`] || process.env.ERP_PASSWORD || 'changeme',
      tenant:   process.env[`${id.toUpperCase().replace(/-/g, '_')}_TENANT`]   || 'default',
    },
    middleware: {
      baseUrl:        mwBase,
      apiKey:         process.env[`${id.toUpperCase().replace(/-/g, '_')}_MW_KEY`] || process.env.MIDDLEWARE_API_KEY,
      healthEndpoint: '/health',
    },
    ssrs: {
      baseUrl:       ssrsBase,
      username:      process.env[`${id.toUpperCase().replace(/-/g, '_')}_SSRS_USER`] || process.env.SSRS_USERNAME || 'report_user',
      password:      process.env[`${id.toUpperCase().replace(/-/g, '_')}_SSRS_PASS`] || process.env.SSRS_PASSWORD || 'changeme',
      invoiceReport: process.env.SSRS_INVOICE_REPORT || '/Reports/Invoice/ReprintInvoice',
    },
    checkmk: {
      hostName: `pw-${id}`,
    },
    tags,
    enabled: true,
  };
}

// ─── Site Registry (80+ entries) ──────────────────────────────────────────────
export const SITES: SiteConfig[] = [
  // US East
  site('us-east-01', 'New York HQ',        'us-east',  'us', 'https://erp-ny.example.com',     'https://api-ny.example.com',     'https://reports-ny.example.com',     ['erp', 'ssrs']),
  site('us-east-02', 'Boston Branch',       'us-east',  'us', 'https://erp-bos.example.com',    'https://api-bos.example.com',    'https://reports-bos.example.com',    ['erp']),
  site('us-east-03', 'Philadelphia Office', 'us-east',  'us', 'https://erp-phi.example.com',    'https://api-phi.example.com',    'https://reports-phi.example.com',    ['erp', 'ssrs']),
  site('us-east-04', 'Washington DC',       'us-east',  'us', 'https://erp-dc.example.com',     'https://api-dc.example.com',     'https://reports-dc.example.com',     ['erp']),
  site('us-east-05', 'Charlotte Branch',    'us-east',  'us', 'https://erp-clt.example.com',    'https://api-clt.example.com',    'https://reports-clt.example.com',    ['erp']),

  // US Central
  site('us-cent-01', 'Chicago HQ',          'us-central','us','https://erp-chi.example.com',    'https://api-chi.example.com',    'https://reports-chi.example.com',    ['erp', 'ssrs']),
  site('us-cent-02', 'Dallas Office',        'us-central','us','https://erp-dfw.example.com',   'https://api-dfw.example.com',    'https://reports-dfw.example.com',    ['erp']),
  site('us-cent-03', 'Houston Branch',       'us-central','us','https://erp-hou.example.com',   'https://api-hou.example.com',    'https://reports-hou.example.com',    ['erp']),
  site('us-cent-04', 'Minneapolis Office',   'us-central','us','https://erp-msp.example.com',   'https://api-msp.example.com',    'https://reports-msp.example.com',    ['erp']),
  site('us-cent-05', 'St. Louis Branch',     'us-central','us','https://erp-stl.example.com',   'https://api-stl.example.com',    'https://reports-stl.example.com',    ['erp']),

  // US West
  site('us-west-01', 'Los Angeles HQ',      'us-west',  'us', 'https://erp-lax.example.com',    'https://api-lax.example.com',    'https://reports-lax.example.com',    ['erp', 'ssrs']),
  site('us-west-02', 'San Francisco',        'us-west',  'us', 'https://erp-sfo.example.com',    'https://api-sfo.example.com',    'https://reports-sfo.example.com',    ['erp']),
  site('us-west-03', 'Seattle Office',       'us-west',  'us', 'https://erp-sea.example.com',    'https://api-sea.example.com',    'https://reports-sea.example.com',    ['erp']),
  site('us-west-04', 'Denver Branch',        'us-west',  'us', 'https://erp-den.example.com',    'https://api-den.example.com',    'https://reports-den.example.com',    ['erp']),
  site('us-west-05', 'Phoenix Office',       'us-west',  'us', 'https://erp-phx.example.com',    'https://api-phx.example.com',    'https://reports-phx.example.com',    ['erp']),
  site('us-west-06', 'Portland Branch',      'us-west',  'us', 'https://erp-pdx.example.com',    'https://api-pdx.example.com',    'https://reports-pdx.example.com',    ['erp']),

  // Europe
  site('eu-west-01', 'London HQ',           'eu-west',  'uk', 'https://erp-lon.example.com',    'https://api-lon.example.com',    'https://reports-lon.example.com',    ['erp', 'ssrs']),
  site('eu-west-02', 'Paris Office',         'eu-west',  'fr', 'https://erp-par.example.com',    'https://api-par.example.com',    'https://reports-par.example.com',    ['erp']),
  site('eu-west-03', 'Amsterdam Office',     'eu-west',  'nl', 'https://erp-ams.example.com',    'https://api-ams.example.com',    'https://reports-ams.example.com',    ['erp']),
  site('eu-west-04', 'Brussels Branch',      'eu-west',  'be', 'https://erp-bru.example.com',    'https://api-bru.example.com',    'https://reports-bru.example.com',    ['erp']),
  site('eu-west-05', 'Dublin Office',        'eu-west',  'ie', 'https://erp-dub.example.com',    'https://api-dub.example.com',    'https://reports-dub.example.com',    ['erp']),
  site('eu-cent-01', 'Frankfurt HQ',         'eu-central','de','https://erp-fra.example.com',   'https://api-fra.example.com',    'https://reports-fra.example.com',    ['erp', 'ssrs']),
  site('eu-cent-02', 'Munich Office',        'eu-central','de','https://erp-muc.example.com',   'https://api-muc.example.com',    'https://reports-muc.example.com',    ['erp']),
  site('eu-cent-03', 'Vienna Branch',        'eu-central','at','https://erp-vie.example.com',   'https://api-vie.example.com',    'https://reports-vie.example.com',    ['erp']),
  site('eu-cent-04', 'Zurich Office',        'eu-central','ch','https://erp-zrh.example.com',   'https://api-zrh.example.com',    'https://reports-zrh.example.com',    ['erp']),
  site('eu-cent-05', 'Warsaw Branch',        'eu-central','pl','https://erp-waw.example.com',   'https://api-waw.example.com',    'https://reports-waw.example.com',    ['erp']),
  site('eu-south-01','Madrid HQ',            'eu-south', 'es', 'https://erp-mad.example.com',   'https://api-mad.example.com',    'https://reports-mad.example.com',    ['erp', 'ssrs']),
  site('eu-south-02','Milan Office',         'eu-south', 'it', 'https://erp-mxp.example.com',   'https://api-mxp.example.com',    'https://reports-mxp.example.com',    ['erp']),
  site('eu-north-01','Stockholm HQ',         'eu-north', 'se', 'https://erp-sto.example.com',   'https://api-sto.example.com',    'https://reports-sto.example.com',    ['erp', 'ssrs']),
  site('eu-north-02','Copenhagen Office',    'eu-north', 'dk', 'https://erp-cph.example.com',   'https://api-cph.example.com',    'https://reports-cph.example.com',    ['erp']),
  site('eu-north-03','Helsinki Branch',      'eu-north', 'fi', 'https://erp-hel.example.com',   'https://api-hel.example.com',    'https://reports-hel.example.com',    ['erp']),

  // APAC
  site('ap-east-01', 'Tokyo HQ',             'apac-east','jp', 'https://erp-tyo.example.com',   'https://api-tyo.example.com',    'https://reports-tyo.example.com',    ['erp', 'ssrs']),
  site('ap-east-02', 'Seoul Office',          'apac-east','kr', 'https://erp-sel.example.com',   'https://api-sel.example.com',    'https://reports-sel.example.com',    ['erp']),
  site('ap-east-03', 'Shanghai Office',       'apac-east','cn', 'https://erp-sha.example.com',   'https://api-sha.example.com',    'https://reports-sha.example.com',    ['erp']),
  site('ap-east-04', 'Beijing Branch',        'apac-east','cn', 'https://erp-bjs.example.com',   'https://api-bjs.example.com',    'https://reports-bjs.example.com',    ['erp']),
  site('ap-east-05', 'Hong Kong Office',      'apac-east','hk', 'https://erp-hkg.example.com',   'https://api-hkg.example.com',    'https://reports-hkg.example.com',    ['erp']),
  site('ap-south-01','Singapore HQ',          'apac-south','sg','https://erp-sin.example.com',   'https://api-sin.example.com',    'https://reports-sin.example.com',    ['erp', 'ssrs']),
  site('ap-south-02','Mumbai Office',         'apac-south','in','https://erp-bom.example.com',   'https://api-bom.example.com',    'https://reports-bom.example.com',    ['erp']),
  site('ap-south-03','Bangalore Branch',      'apac-south','in','https://erp-blr.example.com',   'https://api-blr.example.com',    'https://reports-blr.example.com',    ['erp']),
  site('ap-south-04','Sydney HQ',             'apac-south','au','https://erp-syd.example.com',   'https://api-syd.example.com',    'https://reports-syd.example.com',    ['erp', 'ssrs']),
  site('ap-south-05','Melbourne Office',      'apac-south','au','https://erp-mel.example.com',   'https://api-mel.example.com',    'https://reports-mel.example.com',    ['erp']),
  site('ap-south-06','Auckland Branch',       'apac-south','nz','https://erp-akl.example.com',   'https://api-akl.example.com',    'https://reports-akl.example.com',    ['erp']),
  site('ap-sea-01',  'Bangkok Office',        'apac-sea', 'th', 'https://erp-bkk.example.com',   'https://api-bkk.example.com',    'https://reports-bkk.example.com',    ['erp']),
  site('ap-sea-02',  'Jakarta Office',        'apac-sea', 'id', 'https://erp-jkt.example.com',   'https://api-jkt.example.com',    'https://reports-jkt.example.com',    ['erp']),
  site('ap-sea-03',  'Kuala Lumpur Office',   'apac-sea', 'my', 'https://erp-kul.example.com',   'https://api-kul.example.com',    'https://reports-kul.example.com',    ['erp']),

  // MENA
  site('me-01',      'Dubai HQ',              'mena',     'ae', 'https://erp-dxb.example.com',   'https://api-dxb.example.com',    'https://reports-dxb.example.com',    ['erp', 'ssrs']),
  site('me-02',      'Abu Dhabi Office',       'mena',     'ae', 'https://erp-auh.example.com',   'https://api-auh.example.com',    'https://reports-auh.example.com',    ['erp']),
  site('me-03',      'Riyadh Office',          'mena',     'sa', 'https://erp-ruh.example.com',   'https://api-ruh.example.com',    'https://reports-ruh.example.com',    ['erp']),
  site('me-04',      'Doha Branch',            'mena',     'qa', 'https://erp-doh.example.com',   'https://api-doh.example.com',    'https://reports-doh.example.com',    ['erp']),
  site('me-05',      'Cairo Office',           'mena',     'eg', 'https://erp-cai.example.com',   'https://api-cai.example.com',    'https://reports-cai.example.com',    ['erp']),

  // Latin America
  site('latam-01',   'São Paulo HQ',           'latam',    'br', 'https://erp-gru.example.com',   'https://api-gru.example.com',    'https://reports-gru.example.com',    ['erp', 'ssrs']),
  site('latam-02',   'Buenos Aires Office',    'latam',    'ar', 'https://erp-eze.example.com',   'https://api-eze.example.com',    'https://reports-eze.example.com',    ['erp']),
  site('latam-03',   'Mexico City Office',     'latam',    'mx', 'https://erp-mex.example.com',   'https://api-mex.example.com',    'https://reports-mex.example.com',    ['erp']),
  site('latam-04',   'Bogotá Branch',          'latam',    'co', 'https://erp-bog.example.com',   'https://api-bog.example.com',    'https://reports-bog.example.com',    ['erp']),
  site('latam-05',   'Santiago Office',        'latam',    'cl', 'https://erp-scl.example.com',   'https://api-scl.example.com',    'https://reports-scl.example.com',    ['erp']),
  site('latam-06',   'Lima Branch',            'latam',    'pe', 'https://erp-lim.example.com',   'https://api-lim.example.com',    'https://reports-lim.example.com',    ['erp']),

  // Africa
  site('af-01',      'Johannesburg HQ',        'africa',   'za', 'https://erp-jnb.example.com',   'https://api-jnb.example.com',    'https://reports-jnb.example.com',    ['erp', 'ssrs']),
  site('af-02',      'Nairobi Office',          'africa',   'ke', 'https://erp-nbo.example.com',   'https://api-nbo.example.com',    'https://reports-nbo.example.com',    ['erp']),
  site('af-03',      'Lagos Office',            'africa',   'ng', 'https://erp-los.example.com',   'https://api-los.example.com',    'https://reports-los.example.com',    ['erp']),

  // Additional US Sites to reach 80+
  site('us-east-06', 'Atlanta Office',         'us-east',  'us', 'https://erp-atl.example.com',   'https://api-atl.example.com',    'https://reports-atl.example.com',    ['erp']),
  site('us-east-07', 'Miami Branch',            'us-east',  'us', 'https://erp-mia.example.com',   'https://api-mia.example.com',    'https://reports-mia.example.com',    ['erp']),
  site('us-east-08', 'Nashville Office',        'us-east',  'us', 'https://erp-bna.example.com',   'https://api-bna.example.com',    'https://reports-bna.example.com',    ['erp']),
  site('us-east-09', 'Pittsburgh Branch',       'us-east',  'us', 'https://erp-pit.example.com',   'https://api-pit.example.com',    'https://reports-pit.example.com',    ['erp']),
  site('us-east-10', 'Baltimore Office',        'us-east',  'us', 'https://erp-bwi.example.com',   'https://api-bwi.example.com',    'https://reports-bwi.example.com',    ['erp']),
  site('us-cent-06', 'Kansas City Office',      'us-central','us','https://erp-mci.example.com',  'https://api-mci.example.com',    'https://reports-mci.example.com',    ['erp']),
  site('us-cent-07', 'Indianapolis Branch',     'us-central','us','https://erp-ind.example.com',  'https://api-ind.example.com',    'https://reports-ind.example.com',    ['erp']),
  site('us-cent-08', 'Columbus Office',         'us-central','us','https://erp-cmh.example.com',  'https://api-cmh.example.com',    'https://reports-cmh.example.com',    ['erp']),
  site('us-west-07', 'Las Vegas Branch',        'us-west',  'us', 'https://erp-las.example.com',   'https://api-las.example.com',    'https://reports-las.example.com',    ['erp']),
  site('us-west-08', 'Salt Lake City Office',   'us-west',  'us', 'https://erp-slc.example.com',   'https://api-slc.example.com',    'https://reports-slc.example.com',    ['erp']),
  site('us-west-09', 'San Diego Branch',        'us-west',  'us', 'https://erp-san.example.com',   'https://api-san.example.com',    'https://reports-san.example.com',    ['erp']),
  site('us-west-10', 'Sacramento Office',       'us-west',  'us', 'https://erp-smf.example.com',   'https://api-smf.example.com',    'https://reports-smf.example.com',    ['erp']),
  site('eu-east-01', 'Prague Office',           'eu-east',  'cz', 'https://erp-prg.example.com',   'https://api-prg.example.com',    'https://reports-prg.example.com',    ['erp']),
  site('eu-east-02', 'Budapest Branch',         'eu-east',  'hu', 'https://erp-bud.example.com',   'https://api-bud.example.com',    'https://reports-bud.example.com',    ['erp']),
  site('eu-east-03', 'Bucharest Office',        'eu-east',  'ro', 'https://erp-otp.example.com',   'https://api-otp.example.com',    'https://reports-otp.example.com',    ['erp']),
  site('eu-east-04', 'Sofia Branch',            'eu-east',  'bg', 'https://erp-sof.example.com',   'https://api-sof.example.com',    'https://reports-sof.example.com',    ['erp']),
  site('eu-east-05', 'Athens Office',           'eu-east',  'gr', 'https://erp-ath.example.com',   'https://api-ath.example.com',    'https://reports-ath.example.com',    ['erp']),
  site('ap-east-06', 'Taipei Office',           'apac-east','tw', 'https://erp-tpe.example.com',   'https://api-tpe.example.com',    'https://reports-tpe.example.com',    ['erp']),
  site('ap-east-07', 'Osaka Branch',            'apac-east','jp', 'https://erp-osa.example.com',   'https://api-osa.example.com',    'https://reports-osa.example.com',    ['erp']),
  site('ap-sea-04',  'Manila Office',           'apac-sea', 'ph', 'https://erp-mnl.example.com',   'https://api-mnl.example.com',    'https://reports-mnl.example.com',    ['erp']),
  site('ap-sea-05',  'Ho Chi Minh City Office', 'apac-sea', 'vn', 'https://erp-sgn.example.com',   'https://api-sgn.example.com',    'https://reports-sgn.example.com',    ['erp']),
  site('me-06',      'Beirut Office',           'mena',     'lb', 'https://erp-bey.example.com',   'https://api-bey.example.com',    'https://reports-bey.example.com',    ['erp']),
  site('me-07',      'Amman Branch',            'mena',     'jo', 'https://erp-amm.example.com',   'https://api-amm.example.com',    'https://reports-amm.example.com',    ['erp']),
  site('af-04',      'Casablanca Office',       'africa',   'ma', 'https://erp-cmn.example.com',   'https://api-cmn.example.com',    'https://reports-cmn.example.com',    ['erp']),
  site('af-05',      'Accra Branch',            'africa',   'gh', 'https://erp-acc.example.com',   'https://api-acc.example.com',    'https://reports-acc.example.com',    ['erp']),
];

export function getEnabledSites(): SiteConfig[] {
  return SITES.filter(s => s.enabled);
}

export function getSitesByGroup(group: string): SiteConfig[] {
  return SITES.filter(s => s.enabled && s.group === group);
}

export function getSiteById(id: string): SiteConfig | undefined {
  return SITES.find(s => s.id === id);
}

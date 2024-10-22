const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Variables de entorno para URL del SAT y contraseña del CSD
const SAT_API_URL = 'https://portalcfdi.facturaelectronica.sat.gob.mx'; // Production URL for CFDI
const SAT_AUTH_URL = 'https://cfdiau.sat.gob.mx'; // Production URL for authentication
const password = process.env.CSD_PASSWORD; // Add the password for the FIEL or CSD in your Vercel environment

// Rutas a los archivos del Certificado de Sello Digital (CSD) y FIEL
const keyPathFIEL = path.join(__dirname, '/certs/Claveprivada_FIEL_URE180429TM6_20230518_060411.key');
const certPathFIEL = path.join(__dirname, '/certs/ure180429tm6.cer'); // FIEL certificate
const keyPathCSD = path.join(__dirname, '/certs/CSD_Sucursal_1_URE180429TM6_20230518_063131.key'); // CSD private key
const certPathCSD = path.join(__dirname, '/certs/CSD_Sucursal_1_URE180429TM6_20230518_063131.cer'); // CSD certificate

// Lee los archivos de la clave privada y los certificados
const privateKeyFIEL = fs.readFileSync(keyPathFIEL, 'utf8');
const certificateFIEL = fs.readFileSync(certPathFIEL, 'utf8');
const privateKeyCSD = fs.readFileSync(keyPathCSD, 'utf8');
const certificateCSD = fs.readFileSync(certPathCSD, 'utf8');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  const { rfcEmisor, rfcReceptor, concepto, monto } = req.body;

  try {
    // Llama a la función de autenticación para obtener el token del SAT
    const token = await autenticarConSAT();

    // Hacer la solicitud de factura al SAT
    const facturaResponse = await fetch(SAT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        rfcEmisor,
        rfcReceptor,
        concepto,
        monto
      })
    });

    const facturaResult = await facturaResponse.json();

    if (facturaResponse.ok) {
      res.status(200).json({
        message: 'Factura generada exitosamente',
        facturaId: facturaResult.facturaId,
        xmlUrl: facturaResult.xmlUrl,  // URL para descargar el XML
        pdfUrl: facturaResult.pdfUrl   // URL para descargar el PDF (representación impresa)
      });
    } else {
      res.status(400).json({ message: 'Error al generar la factura', error: facturaResult.message });
    }
  } catch (error) {
    console.error('Error al generar la factura:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
}

// Función para autenticar con el SAT y obtener el token
async function autenticarConSAT() {
  const response = await fetch(SAT_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
    },
    body: `
      <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
          <s:Header>
              <o:Security xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
                  <o:BinarySecurityToken>
                    ${certificateCSD}  <!-- Usando el certificado CSD para la autenticación -->
                  </o:BinarySecurityToken>
              </o:Security>
          </s:Header>
          <s:Body>
              <!-- Información de autenticación -->
          </s:Body>
      </s:Envelope>
    `
  });

  if (response.ok) {
    const data = await response.text();
    const token = parseToken(data);  // Función para extraer el token del XML
    return token;
  } else {
    throw new Error('Error en la autenticación con el SAT');
  }
}

// Función para extraer el token del XML de respuesta
function parseToken(xmlResponse) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlResponse, "application/xml");
  const token = xmlDoc.getElementsByTagName("BinarySecurityToken")[0].textContent;
  return token;
}

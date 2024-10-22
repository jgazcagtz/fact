const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Variables de entorno para URL del SAT y contraseña del CSD
const SAT_API_URL = process.env.SAT_API_URL || 'https://pruebasapi.sat.gob.mx/facturacion';
const SAT_AUTH_URL = process.env.SAT_AUTH_URL || 'https://pruebasapi.sat.gob.mx/autenticacion';
const password = process.env.CSD_PASSWORD;

// Rutas a los archivos del Certificado de Sello Digital (CSD)
const keyPath = path.join(__dirname, '/certs/CSD_Sucursal_1_URE180429TM6_20230518_063131.key');
const certPath = path.join(__dirname, '/certs/data/CSD_Sucursal_1_URE180429TM6_20230518_063131.cer');

// Lee los archivos de la clave privada y el certificado
const privateKey = fs.readFileSync(keyPath, 'utf8');
const certificate = fs.readFileSync(certPath, 'utf8');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  const { rfcEmisor, rfcReceptor, concepto, monto } = req.body;

  try {
    // Llama a la función de autenticación para obtener el token de prueba del SAT
    const token = await autenticarConSAT();

    // Hacer la solicitud de factura al SAT (ambiente de pruebas)
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

// Función para autenticar con el SAT (entorno de pruebas) y obtener el token
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
                    ${certificate}
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

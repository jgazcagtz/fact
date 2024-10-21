document.getElementById('facturaForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const rfcEmisor = document.getElementById('rfcEmisor').value;
    const rfcReceptor = document.getElementById('rfcReceptor').value;
    const concepto = document.getElementById('concepto').value;
    const monto = document.getElementById('monto').value;

    try {
        const response = await fetch('/api/generateInvoice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                rfcEmisor,
                rfcReceptor,
                concepto,
                monto
            })
        });

        const result = await response.json();

        if (response.ok) {
            document.getElementById('resultado').innerText = `Factura de prueba generada exitosamente: ${result.facturaId}`;
            document.getElementById('xmlLink').href = result.xmlUrl;
            document.getElementById('pdfLink').href = result.pdfUrl;
            document.getElementById('descargas').style.display = 'block';
        } else {
            document.getElementById('resultado').innerText = `Error: ${result.message}`;
        }
    } catch (error) {
        console.error('Error al generar la factura de prueba:', error);
        document.getElementById('resultado').innerText = 'Hubo un error al generar la factura de prueba.';
    }
});

import PDFDocument from 'pdfkit';

function labelModalidad(m) {
  if (m === 'online') return 'Virtual';
  if (m === 'presencial') return 'Presencial';
  if (m === 'ambos') return 'Presencial y virtual';
  return String(m || '—');
}

/**
 * Genera PDF con desglose de clases del mes (fecha, día, hora, materias, modalidad).
 */
export function streamPdfReporteHorasAsesora(res, entry, { anio, mes }) {
  const a = entry.asesora;
  const nombreAsesora = a ? `${a.nombre || ''} ${a.apellidos || ''}`.trim() : 'Asesora';
  const mesNombre = mes
    ? new Date(2000, parseInt(String(mes), 10) - 1, 1).toLocaleString('es-BO', { month: 'long' })
    : 'Todo el año';
  const periodo = mes && anio ? `${mesNombre} ${anio}` : anio ? `Año ${anio}` : 'Período';

  const safeFile = `clases-${nombreAsesora}`.replace(/[^\w\s-áéíóúñü]/gi, '').replace(/\s+/g, '_').slice(0, 80);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFile}-${anio || 'a'}-${mes || 'm'}.pdf"`);

  const doc = new PDFDocument({
    margin: 36,
    size: 'A4',
    info: { Title: `Clases — ${nombreAsesora}`, Author: 'Sistema de horarios' },
  });
  doc.pipe(res);

  doc.fontSize(14).font('Helvetica-Bold').text('Detalle de clases (reporte de horas)', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica').text(`Asesora: ${nombreAsesora}`, { align: 'left' });
  doc.text(`Período: ${periodo}`);
  if (entry.fechaConteoHorasDesde) {
    doc.fontSize(9).fillColor('#444444').text(
      `Conteo desde: ${new Date(entry.fechaConteoHorasDesde).toLocaleDateString('es-BO')}`,
      { align: 'left' }
    );
    doc.fillColor('#000000');
  }
  doc.moveDown(0.8);
  doc.fontSize(10).font('Helvetica-Bold').text(
    `Resumen: ${entry.horas ?? 0} h realizadas · ${entry.horasNoHechas ?? 0} no realizadas · Total sesiones: ${(entry.horas || 0) + (entry.horasNoHechas || 0)}`
  );
  doc.moveDown(1);

  const sesiones = [...(entry.sesiones || [])].sort((x, y) => {
    const fx = new Date(x.fecha).getTime();
    const fy = new Date(y.fecha).getTime();
    if (fx !== fy) return fx - fy;
    return String(x.horaInicio || '').localeCompare(String(y.horaInicio || ''));
  });

  const col = { fecha: 40, dia: 105, hora: 175, materias: 255, mod: 400, horaOk: 500 };
  const rowH = 14;
  let y = doc.y;

  function headerRow() {
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Fecha', col.fecha, y, { width: 60 });
    doc.text('Día', col.dia, y, { width: 65 });
    doc.text('Hora', col.hora, y, { width: 75 });
    doc.text('Materias / cursos', col.materias, y, { width: 135 });
    doc.text('Modalidad', col.mod, y, { width: 90 });
    doc.text('1 h', col.horaOk, y, { width: 40 });
    y += rowH;
    doc.moveTo(36, y).lineTo(559, y).stroke('#cccccc');
    y += 4;
    doc.font('Helvetica');
  }

  headerRow();

  for (const s of sesiones) {
    if (y > 720) {
      doc.addPage();
      y = 50;
      headerRow();
    }
    const fechaTxt = new Date(s.fecha).toLocaleDateString('es-BO');
    const materias = (s.materias || '—').length > 90 ? `${(s.materias || '').slice(0, 87)}…` : (s.materias || '—');
    doc.fontSize(7.5);
    doc.text(fechaTxt, col.fecha, y, { width: 62 });
    const dia = (s.diaSemana || '—').charAt(0).toUpperCase() + (s.diaSemana || '').slice(1);
    doc.text(dia, col.dia, y, { width: 65 });
    doc.text(`${s.horaInicio || ''}–${s.horaFin || ''}`, col.hora, y, { width: 75 });
    doc.text(materias, col.materias, y, { width: 135 });
    doc.text(labelModalidad(s.modalidad), col.mod, y, { width: 90 });
    const ok = s.pasoClase ? 'Sí' : 'No';
    doc.text(ok, col.horaOk, y, { width: 35 });
    if (s.sesionPorSustitucion) {
      y += rowH - 2;
      doc.fontSize(6.5).fillColor('#555555').text(`Sustitución (titular: ${s.asesoraTitularNombre || '—'})`, col.fecha, y, { width: 480 });
      doc.fillColor('#000000');
    }
    y += rowH;
  }

  doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666');
  doc.text(
    'Las materias corresponden a las funciones configuradas en cada franja (horario). Una sesión cuenta 1 hora cuando la asesora marcó la clase como pasada.',
    36,
    Math.min(y + 20, 750),
    { width: 520, align: 'left' }
  );

  doc.end();
}

/* Guard de fechas para reservas: se ejecuta sin esperar Firebase ni el login.
   Los campos nativos siguen siendo la fuente de verdad del calendario Material 3. */
export function installReservationDateGuard(doc = typeof document === 'undefined' ? null : document) {
  if (!doc) return null;
  const form = doc.querySelector('#reservaForm');
  const checkIn = form?.elements?.fecha_inicio;
  const checkOut = form?.elements?.fecha_fin;
  if (!checkIn || !checkOut || form.dataset.dateGuardReady === 'true') return null;
  form.dataset.dateGuardReady = 'true';
  const editing = new URL(doc.defaultView.location.href).searchParams.has('id');
  const notice = doc.querySelector('#reservationDateNotice');
  const localISO = () => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  };
  const tomorrow = iso => {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, month - 1, day + 1);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  };
  function update() {
    const today = localISO();
    if (!editing) {
      checkIn.min = today;
      checkOut.min = tomorrow(checkIn.value && checkIn.value >= today ? checkIn.value : today);
    }
    const invalidStart = !editing && !!checkIn.value && checkIn.value < today;
    const invalidEnd = !!checkIn.value && !!checkOut.value && checkOut.value <= checkIn.value;
    checkIn.setCustomValidity(invalidStart ? 'El check-in no puede ser anterior a hoy.' : '');
    checkOut.setCustomValidity(invalidEnd ? 'El check-out debe ser posterior al check-in.' : '');
    if (notice) {
      notice.textContent = invalidStart
        ? 'No podés reservar con una fecha de ingreso pasada. Elegí hoy o una fecha futura.'
        : invalidEnd ? 'La fecha de salida debe ser posterior a la de ingreso.'
        : '';
      notice.hidden = !notice.textContent;
    }
    return !(invalidStart || invalidEnd);
  }
  checkIn.addEventListener('input', update);
  checkIn.addEventListener('change', update);
  checkOut.addEventListener('input', update);
  checkOut.addEventListener('change', update);
  form.addEventListener('submit', event => {
    if (!update() || !checkIn.checkValidity() || !checkOut.checkValidity()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      (checkIn.validity.valid ? checkOut : checkIn).reportValidity();
    }
  }, true);
  // Actualizar el límite al cambiar el día mientras la pantalla está abierta.
  doc.defaultView.addEventListener('focus', update);
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) update(); });
  update();
  return { update, editing };
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installReservationDateGuard(document), { once: true });
  else installReservationDateGuard(document);
}

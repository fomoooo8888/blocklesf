// Minuteur dans un Worker : Chrome ralentit les minuteurs des pages en arrière-plan,
// mais pas ceux des Workers. Sert à garder des pauses fiables même onglet masqué.
onmessage = (e) => {
  const { id, ms } = e.data;
  setTimeout(() => postMessage(id), ms);
};

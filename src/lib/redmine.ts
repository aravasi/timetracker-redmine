import { get } from 'svelte/store';
import { settings, queue, status, isProcessing } from './stores';
import type { Settings } from './stores';

/**
 * @typedef {Object} TimeEntryPayload
 * @property {number} issue_id
 * @property {Date} date
 * @property {number} hours
 * @property {number} activity_id
 * @property {string} comments
 * @property {string} spent_on - Formato YYYY-MM-DD
 */
export interface TimeEntryPayload {
   issue_id: number;
   date: Date;
   hours: number;
   activity_id: number;
   comments: string;
   spent_on: string;
}

/**
 * @typedef {Object} QueuedRequest
 * @property {string} id - Un ID unico per la richiesta (es. timestamp)
 * @property {TimeEntryPayload} payload - Il body della richiesta
 * @property {string} redmineUrl - L'URL usato per questa richiesta
 * @property {string} apiKey - L'API key usata
 */
export interface QueuedRequest {
   id: string;
   payload: TimeEntryPayload;
   redmineUrl: string;
   apiKey: string;
}

/**
 * Tenta di inviare una singola richiesta a Redmine.
 * @param {QueuedRequest} requestObject
 * @returns {Promise<boolean>} True se ha successo, false se fallisce
 */
async function trySendRequest(requestObject: QueuedRequest): Promise<boolean> {
   const { payload, redmineUrl, apiKey } = requestObject;

   // Simula un delay per testare lo stato 'isProcessing'
   // await new Promise(resolve => setTimeout(resolve, 1000));

   try {
      const response = await fetch(`${redmineUrl}/time_entries.json`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'X-Redmine-API-Key': apiKey
         },
         body: JSON.stringify({ time_entry: payload })
      });

      if (response.ok) {
         console.log('Richiesta inviata con successo:', payload.issue_id);
         return true;
      } else {
         // Errore del server (es. 404, 422, 500), non un errore di rete
         // La richiesta è "cattiva" e non dovrebbe essere ritentata
         console.error('Errore server Redmine:', response.status, await response.text());
         status.set(
            `Errore: Server Redmine ha rifiutato la richiesta (Issue ${payload.issue_id}). Rimossa dalla coda.`
         );
         return true; // Rimuoviamo dalla coda anche se è un errore, perché non è un problema di rete
      }
   } catch (error) {
      // Errore di rete (server down, no internet)
      if (error instanceof Error) {
         console.warn('Errore di rete, server non raggiungibile:', error.message);
      } else {
         console.warn('Errore di rete sconosciuto');
      }
      return false; // Mantiene in coda
   }
}

/**
 * Aggiunge una richiesta fallita alla coda.
 * @param {TimeEntryPayload} payload
 */
function addToQueue(payload: TimeEntryPayload) {
   const { redmineUrl, apiKey } = get(settings);

   const newRequest: QueuedRequest = {
      id: `req_${new Date().getTime()}`, // ID unico
      payload,
      redmineUrl,
      apiKey
   };

   queue.update((currentQueue) => [...currentQueue, newRequest]);
   status.set(`Offline: Richiesta per Issue #${payload.issue_id} accodata.`);
}

/**
 * Funzione principale chiamata dall'utente per registrare le ore.
 * Tenta l'invio e, se fallisce, mette in coda.
 * @param {TimeEntryPayload} payload
 */
export async function logTime(payload: TimeEntryPayload) {
   isProcessing.set(true);
   status.set('Invio richiesta...');

   const { redmineUrl, apiKey }: Settings = get(settings);
   const requestObject: QueuedRequest = {
      id: `req_${new Date().getTime()}`,
      payload,
      redmineUrl,
      apiKey
   };

   const success = await trySendRequest(requestObject);

   if (success) {
      status.set(`Successo: Ore per Issue #${payload.issue_id} registrate.`);
      // Se abbiamo successo, cogliamo l'occasione per processare la coda
      await processQueue();
   } else {
      // Fallimento di rete, aggiungi alla coda
      addToQueue(payload);
   }

   isProcessing.set(false);
}

/**
 * Processa sequenzialmente le richieste nella coda.
 * Si ferma al primo fallimento (per evitare di sovraccaricare la rete).
 */
export async function processQueue() {
   if (get(isProcessing)) return; // Già in corso
   const currentQueue = get(queue);
   if (currentQueue.length === 0) return; // Coda vuota

   isProcessing.set(true);
   status.set(`Riprovo ${currentQueue.length} richieste in coda...`);

   // Usiamo un loop `while` per processare la coda FIFO
   // Lavoriamo su una copia della coda per evitare problemi di concorrenza con lo store
   let queueCopy = [...currentQueue];

   while (queueCopy.length > 0) {
      const requestToTry = queueCopy[0]; // Prende il primo elemento

      status.set(`Riprovo Issue #${requestToTry.payload.issue_id}...`);
      const success = await trySendRequest(requestToTry);

      if (success) {
         // Rimuovi l'elemento dalla coda REALE
         queue.update((q) => q.filter((item) => item.id !== requestToTry.id));
         // Rimuovi dalla copia locale per continuare il ciclo
         queueCopy.shift();
         status.set(
            `Successo: Richiesta in coda (Issue #${requestToTry.payload.issue_id}) inviata.`
         );
      } else {
         // Fallimento (probabilmente ancora offline)
         // Interrompi il ciclo e riprova più tardi
         status.set('Offline: Impossibile svuotare la coda. Riproveremo più tardi.');
         break;
      }
   }

   isProcessing.set(false);
   if (get(queue).length === 0) {
      status.set('Coda offline svuotata con successo!');
   }
}

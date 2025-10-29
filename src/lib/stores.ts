import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type { QueuedRequest } from './redmine';

// Controlla se siamo nel browser (questo codice non deve girare sul server)
const isBrowser = typeof window !== 'undefined';

/**
 * Definiamo l'interfaccia per le nostre impostazioni
 */
export interface Settings {
   redmineUrl: string;
   apiKey: string;
}

/**
 * Crea uno store Svelte 'writable' che persiste i dati nel localStorage.
 * Ora è una funzione generica e tipizzata.
 * @param {string} key La chiave per il localStorage
 * @param {T} startValue Il valore di default
 * @returns {Writable<T>}
 * @template T
 */
function createPersistentStore<T>(key: string, startValue: T): Writable<T> {
   const storedValue = isBrowser ? localStorage.getItem(key) : null;
   const initialValue: T = storedValue ? JSON.parse(storedValue) : startValue;

   const store = writable<T>(initialValue);

   if (isBrowser) {
      store.subscribe((value) => {
         localStorage.setItem(key, JSON.stringify(value));
      });
   }

   return store;
}

// Store per le impostazioni dell'utente (URL Redmine e API Key)
export const settings = createPersistentStore<Settings>('redmine_settings', {
   redmineUrl: '',
   apiKey: ''
});

// Store per la coda delle richieste offline
export const queue = createPersistentStore<QueuedRequest[]>('redmine_request_queue', []);

// Store per i messaggi di stato da mostrare all'utente
export const status: Writable<string> = writable('');

// Store per tracciare se stiamo attivamente processando la coda
export const isProcessing: Writable<boolean> = writable(false);

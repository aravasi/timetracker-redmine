<script lang="ts">
   import { onMount } from "svelte";
   import { settings, queue, status, isProcessing } from "$lib/stores";
   import { logTime, processQueue } from "$lib/redmine";
   import type { TimeEntryPayload } from "$lib/redmine"; // Importiamo il tipo

   // Dati del form (leghiamo a stringhe, poi convertiamo)
   let issueId: string = "";
   let date: Date;
   let hours: string = "";
   let activityId: string = ""; // L'ID dell'attività (es. 9 per 'Sviluppo')
   let comments: string = "";

   // Stato UI
   let showSettings = false;

   async function handleSubmit() {
      if (!$settings.redmineUrl || !$settings.apiKey) {
         $status =
            "Errore: Per favore, imposta URL Redmine e API Key nelle impostazioni.";
         showSettings = true;
         return;
      }

      // Creiamo il payload con i tipi corretti
      const payload: TimeEntryPayload = {
         issue_id: parseInt(issueId, 10),
         date: date,
         hours: parseFloat(hours),
         activity_id: parseInt(activityId, 10),
         comments: comments,
         spent_on: new Date().toISOString().split("T")[0], // Data di oggi
      };

      // Validazione semplice
      if (
         isNaN(payload.issue_id) ||
         isNaN(payload.hours) ||
         isNaN(payload.activity_id)
      ) {
         $status =
            "Errore: Issue ID, Ore e Activity ID devono essere numeri validi.";
         return;
      }

      await logTime(payload);

      // Pulisce il form dopo un invio (anche se è finito in coda)
      if ($status.includes("successo") || $status.includes("accodata")) {
         issueId = "";
         hours = "";
         activityId = "";
         comments = "";
      }
   }

   // Al caricamento dell'app e quando torniamo online, processiamo la coda
   onMount(() => {
      // onMount gira solo nel browser, quindi 'window' è sicuro
      processQueue();
      window.addEventListener("online", processQueue);

      return () => {
         // Pulizia del listener quando il componente viene distrutto
         window.removeEventListener("online", processQueue);
      };
   });
</script>

<svelte:head>
   <title>Redmine Time Tracker</title>
   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</svelte:head>

<div class="flex h-screen w-full flex-col bg-gray-100">
   <!-- Header -->
   <header class="bg-white p-4 shadow-md">
      <div class="mx-auto flex max-w-lg items-center justify-between">
         <h1 class="text-xl font-bold text-gray-800">Redmine Tracker</h1>
         <button
            on:click={() => (showSettings = !showSettings)}
            class="rounded-md p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
         >
            <!-- Icona Impostazioni (SVG) -->
            <svg
               xmlns="http://www.w3.org/2000/svg"
               class="h-6 w-6"
               fill="none"
               viewBox="0 0 24 24"
               stroke="currentColor"
            >
               <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
               />
               <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
               />
            </svg>
         </button>
      </div>
   </header>

   <!-- Contenuto Principale -->
   <main class="flex-1 overflow-y-auto p-4">
      <div class="mx-auto max-w-lg">
         {#if showSettings}
            <!-- Pannello Impostazioni -->
            <div class="rounded-lg bg-white p-6 shadow-lg">
               <h2 class="mb-4 text-lg font-semibold">Impostazioni</h2>
               <div class="space-y-4">
                  <div>
                     <label
                        for="redmineUrl"
                        class="block text-sm font-medium text-gray-700"
                        >URL Redmine</label
                     >
                     <input
                        type="url"
                        id="redmineUrl"
                        bind:value={$settings.redmineUrl}
                        placeholder="https://redmine.esempio.com"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                     />
                  </div>
                  <div>
                     <label
                        for="apiKey"
                        class="block text-sm font-medium text-gray-700"
                        >API Key Personale</label
                     >
                     <input
                        type="password"
                        id="apiKey"
                        bind:value={$settings.apiKey}
                        placeholder="La tua API key di Redmine"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                     />
                  </div>
                  <button
                     on:click={() => (showSettings = false)}
                     class="w-full rounded-md bg-blue-600 px-4 py-2 text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                     Chiudi Impostazioni
                  </button>
               </div>
            </div>
         {:else}
            <!-- Pannello Inserimento Ore -->
            <div class="rounded-lg bg-white p-6 shadow-lg">
               <form on:submit|preventDefault={handleSubmit} class="space-y-4">
                  <div>
                     <label
                        for="issueId"
                        class="block text-sm font-medium text-gray-700"
                        >Issue ID (#)</label
                     >
                     <input
                        type="number"
                        id="issueId"
                        bind:value={issueId}
                        required
                        placeholder="12345"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                     />
                  </div>
                  <div>
                     <label
                        for="date"
                        class="block text-sm font-medium text-gray-700"
                        >Data</label
                     >
                     <input
                        type="date"
                        id="date"
                        bind:value={date}
                        required
                        placeholder="2.5"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                     />
                  </div>
                  <div>
                     <label
                        for="hours"
                        class="block text-sm font-medium text-gray-700"
                        >Ore</label
                     >
                     <input
                        type="number"
                        id="hours"
                        bind:value={hours}
                        step="0.1"
                        required
                        placeholder="2.5"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                     />
                  </div>
                  <div>
                     <label
                        for="activityId"
                        class="block text-sm font-medium text-gray-700"
                        >Activity ID</label
                     >
                     <input
                        type="number"
                        id="activityId"
                        bind:value={activityId}
                        required
                        placeholder="9 (Sviluppo)"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                     />
                  </div>
                  <div>
                     <label
                        for="comments"
                        class="block text-sm font-medium text-gray-700"
                        >Commenti</label
                     >
                     <textarea
                        id="comments"
                        bind:value={comments}
                        rows="3"
                        placeholder="Lavorato su..."
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                     />
                  </div>
                  <button
                     type="submit"
                     disabled={$isProcessing}
                     class="w-full rounded-md bg-green-600 px-4 py-2 text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                     {#if $isProcessing}
                        <span class="animate-pulse">Invio...</span>
                     {:else}
                        Registra Ore
                     {/if}
                  </button>
               </form>
            </div>
         {/if}

         <!-- Status Message -->
         {#if $status}
            <div
               class="mt-4 rounded-md p-3 text-center text-sm font-medium"
               class:bg-green-100={$status.includes("successo")}
               class:text-green-800={$status.includes("successo")}
               class:bg-yellow-100={$status.includes("accodata") ||
                  $status.includes("Riprovo")}
               class:text-yellow-800={$status.includes("accodata") ||
                  $status.includes("Riprovo")}
               class:bg-red-100={$status.includes("Errore")}
               class:text-red-800={$status.includes("Errore")}
            >
               {$status}
            </div>
         {/if}

         <!-- Coda Offline -->
         {#if $queue.length > 0}
            <div class="mt-6">
               <h3 class="text-md font-semibold text-gray-700">
                  Richieste in Coda (Offline)
               </h3>
               <ul class="mt-2 space-y-2">
                  {#each $queue as item (item.id)}
                     <li class="rounded-lg bg-white p-3 shadow">
                        <p class="text-sm font-medium text-gray-900">
                           Issue #{item.payload.issue_id} - {item.payload.hours}
                           ore
                        </p>
                        <p class="text-xs text-gray-600">
                           In attesa di connessione...
                        </p>
                     </li>
                  {/each}
               </ul>
               <button
                  on:click={processQueue}
                  disabled={$isProcessing}
                  class="mt-4 w-full rounded-md bg-gray-600 px-4 py-2 text-sm text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-400"
               >
                  Riprova Coda Manualmente
               </button>
            </div>
         {/if}
      </div>
   </main>
</div>

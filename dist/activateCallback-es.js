/* eslint-env worker */

const {ceil} = Math;
const arrayChunk = (arr, size) => {
  return [...Array.from({length: ceil(arr.length / size)})].map((_, i) => {
    const offset = i * size;
    return arr.slice(offset, offset + size);
  });
};

// Todo: If fetching fails here (or in install), e.g., because activate event
//          never completed
//          to cache, de-register and re-register (?); how to detect if all
//          files in cache?
// Todo: Check `oldVersion` and run this first if still too old

/**
* @callback Logger
* @param {...any} args
* @returns {void}
*/

/**
 * @param {PlainObject} cfg
 * @param {string} cfg.namespace
 * @param {string[]} cfg.files
 * @param {Logger} cfg.log
 * @param {string} [cfg.basePath=""]
 * @returns {Promise<void>}
 */
async function activateCallback ({
  namespace, files, log, basePath = ''
}) {
  // Now we know we have the files cached, we can postpone
  //  the `indexedDB` processing (which will work offline
  //  anyways); also important to avoid conflicts with
  //  already-running versions upon future sw updates
  log('Activate: Callback called');
  const r = await fetch(files);
  const {groups} = await r.json();

  const addJSONFetch = (arr, path) => {
    arr.push(
      (async () => (await fetch(basePath + path)).json())()
    );
  };

  const dataFileNames = [];
  const dataFiles = [];
  const schemaFiles = [];
  const metadataFiles = [];
  groups.forEach(
    ({files: fileObjs, metadataBaseDirectory, schemaBaseDirectory}) => {
      fileObjs.forEach(({file: {$ref: filePath}, metadataFile, schemaFile, name}) => {
        // We don't i18nize the name here
        dataFileNames.push(name);
        addJSONFetch(dataFiles, filePath);
        addJSONFetch(metadataFiles, metadataBaseDirectory + '/' + metadataFile);
        addJSONFetch(schemaFiles, schemaBaseDirectory + '/' + schemaFile);
      });
    }
  );
  const promises = await Promise.all([
    ...dataFiles, ...schemaFiles, ...metadataFiles
  ]);
  const chunked = arrayChunk(promises, dataFiles.length);
  const [
    dataFileResponses, schemaFileResponses, metadataFileResponses
  ] = chunked;

  log('Activate: Files fetched');
  const dbName = namespace + '-textbrowser-cache-data';
  indexedDB.deleteDatabase(dbName);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.addEventListener('upgradeneeded', ({target: {result: db}}) => {
      db.onversionchange = () => {
        db.close();
        const err = new Error('versionchange');
        err.type = 'versionchange';
        reject(err);
      };
      dataFileResponses.forEach(({data: tableRows}, i) => {
        const dataFileName = dataFileNames[i];
        const store = db.createObjectStore('files-to-cache-' + dataFileName);

        const schemaFileResponse = schemaFileResponses[i];
        const metadataFileResponse = metadataFileResponses[i];
        const fieldItems = schemaFileResponse.items.items;

        let browseFields = metadataFileResponse.table.browse_fields;
        browseFields = Array.isArray(browseFields) ? browseFields : [browseFields];

        const columnIndexes = [];
        browseFields.forEach((browseFieldSetObj) => {
          if (typeof browseFieldSetObj === 'string') {
            browseFieldSetObj = {set: [browseFieldSetObj]};
          }
          if (!browseFieldSetObj.name) {
            browseFieldSetObj.name = browseFieldSetObj.set.join(',');
          }
          const browseFieldSetName = browseFieldSetObj.name;
          const browseFieldSetIndexes = browseFieldSetObj.set.map((browseField) => {
            // Need to convert to columns for numbers
            //      to become valid key paths
            return 'c' + (
              fieldItems.findIndex((item) => item.title === browseField)
            );
          });
          columnIndexes.push(...browseFieldSetIndexes);

          log(
            'Activate: Creating index:',
            dataFileName,
            'browseFields-' + browseFieldSetName,
            browseFieldSetIndexes
          );

          // No need for using `presort` as our index will sort anyways
          store.createIndex(
            'browseFields-' + browseFieldSetName,
            browseFieldSetIndexes
          );
        });

        const uniqueColumnIndexes = [...new Set(columnIndexes)];

        tableRows.forEach((tableRow, j) => {
          // Todo: Optionally send notice when complete
          // To take advantage of indexes on our arrays, we
          //   need to transform them to objects! See https://github.com/w3c/IndexedDB/issues/209
          const objRow = {
            value: tableRow
          };
          uniqueColumnIndexes.forEach((colIdx) => {
            objRow[colIdx] = tableRow[colIdx.slice(1)];
          });
          // log('objRow', objRow);
          store.put(objRow, j);
        });
      });
    });
    req.addEventListener('success', ({target: {result: db}}) => {
      log('Activate: Database set-up complete', db);
      // Todo: Replace this with `ready()` check
      //   in calling code?
      resolve();
    });
    const onerr = ({error = new Error('dbError')}) => {
      error.type = 'dbError';
      reject(error);
    };
    req.addEventListener('blocked', onerr);
    req.addEventListener('error', onerr);
  });
}

export { activateCallback as default };

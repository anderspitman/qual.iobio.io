import { FileView } from './views/file.js';


class WorkerRPC {

  constructor(workerScriptUri) {
    this._nextId = 1;
    this._worker = new Worker(workerScriptUri);

    this._worker.onmessage = this._handleMessage.bind(this);
    this._requestPromises = {};
  }

  async call(method, params) {

    const id = this._nextId++;

    this._worker.postMessage({
      jsonrpc: '2.0',
      method,
      params,
      id,
    });

    return new Promise((resolve, reject) => {
      this._requestPromises[id] = {
        resolve,
        reject,
      };
    });
  }

  _handleMessage(message) {
    const rpc = message.data;

    if (this._requestPromises[rpc.id]) {
      this._requestPromises[rpc.id].resolve(rpc.result);
      delete this._requestPromises[rpc.id];
    }
  }
}



const contentEl = document.querySelector('.content');

let bamFile = null;
let baiFile = null;

const samtoolsRpc = new WorkerRPC('./samtools_worker.js');

const uppie = new Uppie();
uppie(document.querySelector('#file-input'), async (event, formData, files) => {

  for (const entry of formData.entries()) {

    const file = entry[1];

    if (file.name.endsWith('bam')) {
      bamFile = file;
    }

    if (file.name.endsWith('bai')) {
      baiFile = file;
    }

    if (bamFile && baiFile) {

      const stats = await samtoolsRpc.call('idxstats', {
        bamFile,
        baiFile,
      });

      let refName;
      for (const stat of stats) {
        if (stat.refSeqName === 'chr1') {
          refName = 'chr1';
          break;
        }
        if (stat.refSeqName === '1') {
          refName = '1';
          break;
        }
      }

      if (!refName) {
        alert("Missing chr1, which is needed for read length estimation");
      }

      const readLength = await samtoolsRpc.call('getReadLength', {
        bamFile,
        baiFile,
        refName,
      });
      console.log(readLength);

    }

    //const fileView = FileView(file);
    //contentEl.appendChild(fileView);
  }
});




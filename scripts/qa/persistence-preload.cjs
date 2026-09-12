const {contextBridge,ipcRenderer}=require('electron')
contextBridge.exposeInMainWorld('qaPersistence',{
 deleteAppSpec:p=>ipcRenderer.invoke('delete-app-spec',p),
 getAppSpecs:p=>ipcRenderer.invoke('get-app-specs',p),
 renameAppSpec:p=>ipcRenderer.invoke('rename-app-spec',p),
 saveAppSpec:p=>ipcRenderer.invoke('save-app-spec',p),
})

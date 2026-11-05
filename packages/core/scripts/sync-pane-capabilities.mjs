import fs from 'node:fs'
import {paneCapabilities} from '../src/shared/paneFormatting.js'
const file=new URL('../../../vilsem-renderer/capabilities.json',import.meta.url),value=JSON.parse(fs.readFileSync(file,'utf8'))
// Keep the historical spec property untouched; generate common pane contracts.
value.objects={semantica:value.objects.semantica,...paneCapabilities()}
fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n')

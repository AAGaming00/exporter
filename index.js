const { Plugin } = require('powercord/entities');
// const { getModule } = require('powercord/webpack');
const fs = require('fs');
const { join } = require('path');
const { shell } = require('electron');
// const css = fs.readFileSync(join(__dirname, 'renderer', 'discord.css'));
function byId (id) {
  return document.getElementById(id);
}
function toId (id) {
  return `chat-messages-${id}`;
}
function idIndex (id, array) {
  const filter = array.filter(x => x.id === id);
  return array.indexOf(filter[0]);
}
module.exports = class Exporter extends Plugin {
  startPlugin () {
    powercord.api.commands.registerCommand({
      command: 'archive',
      description: 'Archive a group of messages as an HTML file',
      usage: '{c} <start id> <end id>',
      executor: this.handleCommand.bind(this),
      autocomplete: this.handleAutocomplete.bind(this)
    });
  }

  async export (start, end) {
    console.log(start, end);
    const elem = start ? byId(toId(start)) : document.querySelectorAll('[id*="chat-messages-"]')[0];
    if (!start) {
      start = elem.id.replace('chat-messages-', '');
    }
    const children = Array.from(elem.parentNode.childNodes);
    const startIndex = idIndex(toId(start), children);
    const endIndex = idIndex(toId(end), children);
    if (startIndex === -1) {
      return;
    }
    const toExport = children.slice(startIndex, endIndex !== -1 ? endIndex : undefined).filter(x => x.className !== 'navigationDescription-3hiGKr' && x.className !== 'wrapper-3vR61M');
    console.log(startIndex, endIndex, toExport);
    const messages = toExport.map(x => x.outerHTML).join('\n');
    let css = '';
    Array.prototype.forEach.call(document.querySelectorAll('link[rel="stylesheet"][href*="/assets"]'), (link) => {
    /*
     *   fetch(link.href).then(r => {
     *       css +=
     *   });
     */
      const newLink = document.createElement('link');
      newLink.href = link.href;
      newLink.rel = link.rel;
      // newLink.href = `https://canary.discord.com${newLink.href}`;
      css += newLink.outerHTML;
    });
    const htmlTemplate = `
    <html class="${document.documentElement.className.replace('mouse-mode ', '')}">
        <head>
            <style>
            @font-face{font-family:Whitney;font-weight:300;src:url(https://cors-anywhere.herokuapp.com/https://canary.discord.com/assets/6c6374bad0b0b6d204d8d6dc4a18d820.woff) format("woff")}@font-face{font-family:Whitney;font-weight:400;src:url(https://cors-anywhere.herokuapp.com/https://canary.discord.com/assets/e8acd7d9bf6207f99350ca9f9e23b168.woff) format("woff")}@font-face{font-family:Whitney;font-weight:500;src:url(https://cors-anywhere.herokuapp.com/https://canary.discord.com/assets/3bdef1251a424500c1b3a78dea9b7e57.woff) format("woff")}@font-face{font-family:Whitney;font-weight:600;src:url(https://cors-anywhere.herokuapp.com/https://canary.discord.com/assets/be0060dafb7a0e31d2a1ca17c0708636.woff) format("woff")}@font-face{font-family:Whitney;font-weight:700;src:url(https://cors-anywhere.herokuapp.com/https://canary.discord.com/assets/8e12fb4f14d9c4592eb8ec9f22337b04.woff) format("woff")}
            </style>
            ${css}
        </head>
        <body>
        <div class="scroller-2LSbBU auto-Ge5KZx scrollerBase-289Jih disableScrollAnchor-3V9UtP" dir="ltr" style="overflow: hidden scroll; padding-right: 0px;">
            <div class="scrollerContent-WzeG7R content-3YMskv"><div class="scrollerInner-2YIMLh" aria-label="Messages in offtopic" role="log" tabindex="0" id="chat-messages" aria-live="off">
                ${messages}
            </div>
        </div>
        </body>
    </html>

    `.replace(/(?<!discord.com)(\/assets\/)/g, 'https://canary.discord.com/assets/');
    const path = join(__dirname, 'exports', `${start}-${end}.html`);
    await fs.promises.writeFile(path, htmlTemplate);
    shell.openPath(path);
  }

  handleCommand (args) {
    this.export(args[0], args[1]);
  }

  pluginWillUnload () {
    powercord.api.commands.unregisterCommand('archive');
  }


  handleAutocomplete (args) {
    if (args.length === 0) {
      return false;
    }

    if (args[0] === '' || args[0] === ' ') {
      return {
        commands: [ {
          command: 'Please input the start message ID, or leave blank to archive all loaded messages...',
          instruction: true
        } ]
      };
    }
    if (args[1] === '' || args[1] === ' ') {
      return {
        commands: [ {
          command: 'Input the end message ID, or leave blank to archive all loaded messages since the start...',
          instruction: true
        } ]
      };
    }
  }
};

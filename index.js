const { Plugin } = require('powercord/entities');
const { get } = require('powercord/http');
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
  const filter = array.filter((x) => x.id === id);
  return array.indexOf(filter[0]);
}

function hash (str) {
  let hash = 0,
    i, chr;
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
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
    const elem = start
      ? byId(toId(start))
      : document.querySelectorAll('[id*="chat-messages-"]')[0];
    if (!start) {
      start = elem.id.replace('chat-messages-', '');
    }
    const children = Array.from(elem.parentNode.childNodes);
    const startIndex = idIndex(toId(start), children);
    const endIndex = idIndex(toId(end), children);
    if (startIndex === -1) {
      return;
    }
    const toExport = children
      .slice(startIndex, endIndex !== -1 ? endIndex : undefined)
      .filter(
        (x) =>
          x.className !== 'navigationDescription-3hiGKr' &&
          x.className !== 'wrapper-3vR61M'
      );
    if (!end) {
      end = toExport[toExport.length - 2].id.replace(
        'chat-messages-',
        ''
      );
    }
    console.log(startIndex, endIndex, toExport);
    let messages = toExport.map((x) => x.outerHTML).join('\n');
    powercord.api.notices.sendToast(
      `exporter-${(Math.random().toString(36) + Date.now()).substring(
        2,
        7
      )}`,
      {
        header: 'Archiving',
        content:
          'Archiving messages...\nMake sure to include the assets folder relative to the file!',
        icon: 'history',
        timeout: 3e3
      }
    );
    const plugincss = [];
    let plugincsslinks = '';
    for (const link of Array.from(
      document.querySelectorAll('style[data-powercord="true"]:not([data-theme="true"])')
    )) {
      const linkid = link.id.replace(/[^-]*$/g, hash(link.innerText));
      plugincss.push(linkid);
      await fs.promises.writeFile(
        join(
          __dirname,
          'exports',
          'assets',
          'plugins',
          `${linkid}.css`
        ),
        link.innerText
      );
    }
    for (const plugin of plugincss) {
      plugincsslinks += `<link rel="stylesheet" href="./assets/${plugin}.css"/>`;
    }
    let discordcss;
    let dcss = '';
    for (const link of Array.from(
      document.querySelectorAll(
        'link[rel="stylesheet"][href*="/assets/"]'
      )
    )) {
      const r = await get(link.href);
      dcss += await r.body.toString();
      discordcss = link.href.split('/')[link.href.split('/').length - 1];
      await fs.promises.writeFile(
        join(
          __dirname,
          'exports',
          'assets',
          link.href.split('/')[link.href.split('/').length - 1]
        ),
        dcss
      );
    }
    const doneMap = {};
    for (const e of [
      ...messages.matchAll(
        /(?:(?:src|href|poster)=")((?:https?:\/\/(?:cdn|media|(?:images-ext-\d))?\.discord(?:app?)\.(?:com|net)|(?:\/assets\/))([^"]*))(?:")/g
      )
    ]) {
      if (e[1] === '' || !e[1]) {
        return;
      }
      let n;
      e[2] = e[2].replace(/&amp;/g, '&');
      e[1] = e[1].replace(/&amp;/g, '&');
      if (!doneMap[e[2]]) {
        console.log(e);
        n = e[2]
          .replace(/\//g, '-')
          .split('?')[0]
          .split('/')
          .filter((eb) => eb !== '')
          .join('-')
          .replace('-mp4', '.mp4');
        try {
          const r = await get(
            !(/\/assets\//g).test(e[1])
              ? e[1]
              : `${window.location.origin}${e[1]}`
          );
          console.log(e[2].split('/'));
          console.log('n', n);
          const path = join(__dirname, 'exports', 'assets', 'cdn', n);
          console.log(r);
          await fs.promises.writeFile(path, r.body);
          doneMap[e[2]] = n;
        } catch (error) {
          console.error(error);
        }
      } else {
        n = doneMap[e[2]];
      }
      if (n) {
        messages = messages.replace(new RegExp(`/${e[1]}/g`), `./assets/cdn/${n}`);
      }
    }
    // button thing is a hack until i figure out how to remove them entirely
    const htmlTemplate = `
    <html class="${`${document.documentElement.className.replace(
    'mouse-mode ',
    ''
  )} mouse-mode`}">
        <head>
            <link rel="stylesheet" href="./assets/${discordcss}">
            <style>
            .buttonContainer-DHceWr {
              display: none;
            }
            </style>
            ${plugincsslinks}
        </head>
        <body>
        <div class="scroller-2LSbBU auto-Ge5KZx scrollerBase-289Jih disableScrollAnchor-3V9UtP" dir="ltr" style="overflow: hidden scroll; padding-right: 0px;">
            <div class="scrollerContent-WzeG7R content-3YMskv"><div class="scrollerInner-2YIMLh" aria-label="Messages in offtopic" role="log" tabindex="0" id="chat-messages" aria-live="off">
                ${messages}
            </div>
        </div>
        </body>
    </html>

    `; // .replace(/(?<!discord.com)(\/assets\/)/g, 'https://canary.discord.com/assets/');
    const htmlPath = join(__dirname, 'exports', `${start}-${end}.html`);
    await fs.promises.writeFile(htmlPath, htmlTemplate);
    shell.openPath(htmlPath);
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
        commands: [
          {
            command:
              'Please input the start message ID, or leave blank to archive all loaded messages...',
            instruction: true
          }
        ]
      };
    }
    if (args[1] === '' || args[1] === ' ') {
      return {
        commands: [
          {
            command:
							'Input the end message ID, or leave blank to archive all loaded messages since the start...',
            instruction: true
          }
        ]
      };
    }
  }
};

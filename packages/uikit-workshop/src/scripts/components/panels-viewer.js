/*!
 * Panel Builder. Supports building the panels to be included in the modal or styleguide
 *
 * Copyright (c) 2013-16 Dave Olsen, http://dmolsen.com
 * Licensed under the MIT license
 *
 * @requires panels.js
 * @requires url-handler.js
 */

import { Panels } from './panels';
import { panelsUtil } from './panels-util';
import { urlHandler, Dispatcher } from '../utils';
import Clipboard from 'clipboard';
import $ from 'jquery';
import Hogan from 'hogan.js';
import Prism from 'prismjs';

export const panelsViewer = {
  // set up some defaults
  targetOrigin:
    window.location.protocol === 'file:'
      ? '*'
      : window.location.protocol + '//' + window.location.host,
  initCopy: false,
  initMoveTo: 0,

  /**
   * Check to see if all of the panels have been collected before rendering
   * @param  {String}      the collected panels
   * @param  {String}      the data from the pattern
   * @param  {Boolean}     if this is going to be passed back to the styleguide
   */
  checkPanels: function(panels, patternData, iframePassback, switchText) {
    // count how many panels have rendered content
    let panelContentCount = 0;
    for (let i = 0; i < panels.length; ++i) {
      if (panels[i].content !== undefined) {
        panelContentCount++;
      }
    }

    // see if the count of panels with content matches number of panels
    if (panelContentCount === Panels.count()) {
      panelsViewer.renderPanels(
        panels,
        patternData,
        iframePassback,
        switchText
      );
    }
  },

  /**
   * Gather the panels related to the modal
   * @param  {String}      the data from the pattern
   * @param  {Boolean}     if this is going to be passed back to the styleguide
   */
  gatherPanels: function(patternData, iframePassback, switchText) {
    Dispatcher.addListener('checkPanels', panelsViewer.checkPanels);

    // set-up defaults
    let template, templateCompiled, templateRendered, panel;

    // get the base panels
    let panels = Panels.get();

    // evaluate panels array and create content
    for (let i = 0; i < panels.length; ++i) {
      panel = panels[i];

      // catch pattern panel since it doesn't have a name defined by default
      if (panel.name === undefined) {
        panel.name =
          patternData.patternEngineName || patternData.patternExtension;
        panel.language = patternData.patternExtension;
      }

      // if httpRequestReplace has not been set, use the extension. this is likely for the raw template
      if (panel.httpRequestReplace === '') {
        panel.httpRequestReplace =
          panel.httpRequestReplace + '.' + patternData.patternExtension;
      }

      if (panel.templateID !== undefined && panel.templateID) {
        if (panel.httpRequest !== undefined && panel.httpRequest) {
          // need a file and then render
          let fileBase = urlHandler.getFileName(
            patternData.patternPartial,
            false
          );
          let e = new XMLHttpRequest();
          e.onload = (function(i, panels, patternData, iframeRequest) {
            return function() {
              const prismedContent = Prism.highlight(
                this.responseText,
                Prism.languages.html
              );
              template = document.getElementById(panels[i].templateID);
              templateCompiled = Hogan.compile(template.innerHTML);
              templateRendered = templateCompiled.render({
                language: 'html',
                code: prismedContent,
              });
              panels[i].content = templateRendered;
              Dispatcher.trigger('checkPanels', [
                panels,
                patternData,
                iframePassback,
                switchText,
              ]);
            };
          })(i, panels, patternData, iframePassback);

          e.open(
            'GET',
            fileBase + panel.httpRequestReplace + '?' + new Date().getTime(),
            true
          );
          e.send();
        } else {
          // vanilla render of pattern data
          template = document.getElementById(panel.templateID);
          templateCompiled = Hogan.compile(template.innerHTML);
          templateRendered = templateCompiled.render(patternData);
          panels[i].content = templateRendered;
          Dispatcher.trigger('checkPanels', [
            panels,
            patternData,
            iframePassback,
            switchText,
          ]);
        }
      }
    }
  },

  /**
   * Render the panels that have been collected
   * @param  {String}      the collected panels
   * @param  {String}      the data from the pattern
   * @param  {Boolean}     if this is going to be passed back to the styleguide
   */
  renderPanels: function(panels, patternData, iframePassback, switchText) {
    // set-up defaults
    let template, templateCompiled, templateRendered;
    let annotation, comment, count, div, els, item, markup, i;
    let patternPartial = patternData.patternPartial;
    patternData.panels = panels;

    // set a default pattern description for modal pop-up
    if (!iframePassback && patternData.patternDesc.length === 0) {
      patternData.patternDesc = '';
    }

    // capitilize the pattern name
    patternData.patternNameCaps = patternData.patternName.toUpperCase();

    // check for annotations in the given mark-up
    markup = document.createElement('div');
    markup.innerHTML = patternData.patternMarkup;

    count = 1;
    patternData.annotations = [];
    delete patternData.patternMarkup;

    for (let i = 0; i < comments.comments.length; ++i) {
      item = comments.comments[i];
      els = markup.querySelectorAll(item.el);

      if (els.length > 0) {
        annotation = {
          displayNumber: count,
          el: item.el,
          title: item.title,
          comment: item.comment,
        };
        patternData.annotations.push(annotation);
        count++;
      }
    }

    // alert the pattern that annotations should be highlighted
    if (patternData.annotations.length > 0) {
      let obj = JSON.stringify({
        event: 'patternLab.annotationsHighlightShow',
        annotations: patternData.annotations,
      });
      document
        .querySelector('.pl-js-iframe')
        .contentWindow.postMessage(obj, panelsViewer.targetOrigin);
    }

    // add hasComma property to lineage
    if (patternData.lineage.length > 0) {
      for (let i = 0; i < patternData.lineage.length; ++i) {
        if (i < patternData.lineage.length - 1) {
          patternData.lineage[i].hasComma = true;
        }
      }
    }

    // add hasComma property to lineageR
    if (patternData.lineageR.length > 0) {
      for (let i = 0; i < patternData.lineageR.length; ++i) {
        if (i < patternData.lineageR.length - 1) {
          patternData.lineageR[i].hasComma = true;
        }
      }
    }

    // add *Exists attributes for Hogan templates
    // figure out if the description exists
    patternData.patternDescExists =
      patternData.patternDesc.length > 0 ||
      (patternData.patternDescAdditions !== undefined &&
        patternData.patternDescAdditions.length > 0);

    // figure out if lineage should be drawn
    patternData.lineageExists = patternData.lineage.length !== 0;

    // figure out if reverse lineage should be drawn
    patternData.lineageRExists = patternData.lineageR.length !== 0;

    // figure out if pattern state should be drawn
    patternData.patternStateExists = patternData.patternState.length > 0;

    // figure if annotations should be drawn
    patternData.annotationExists = patternData.annotations.length > 0;

    // figure if the entire desc block should be drawn
    patternData.descBlockExists =
      patternData.patternDescExists ||
      patternData.lineageExists ||
      patternData.lineageRExists ||
      patternData.patternStateExists ||
      patternData.annotationExists;

    // set isPatternView based on if we have to pass it back to the styleguide level
    patternData.isPatternView = iframePassback === false;

    // render all of the panels in the base panel template
    template = document.querySelector('.pl-js-panel-template-base');
    templateCompiled = Hogan.compile(template.innerHTML);
    templateRendered = templateCompiled.render(patternData);

    // make sure templateRendered is modified to be an HTML element
    div = document.createElement('div');
    div.className = 'pl-c-pattern-info';
    div.innerHTML = templateRendered;
    templateRendered = div;

    // add click events
    templateRendered = panelsUtil.addClickEvents(
      templateRendered,
      patternPartial
    );

    // add onclick events to the tabs in the rendered content
    for (let i = 0; i < panels.length; ++i) {
      const panel = panels[i];

      // default IDs
      const panelTab = '#pl-' + patternPartial + '-' + panel.id + '-tab';
      const panelBlock = '#pl-' + patternPartial + '-' + panel.id + '-panel';

      // show default options
      if (templateRendered.querySelector(panelTab) !== null && panel.default) {
        templateRendered
          .querySelector(panelTab)
          .classList.add('pl-is-active-tab');
        templateRendered
          .querySelector(panelBlock)
          .classList.add('pl-is-active-tab');
      }
    }

    // find lineage links in the rendered content and add postmessage handlers in case it's in the modal
    $('.pl-js-lineage-link', templateRendered).on('click', function(e) {
      e.preventDefault();
      let obj = JSON.stringify({
        event: 'patternLab.updatePath',
        path: urlHandler.getFileName($(this).attr('data-patternpartial')),
      });
      document
        .querySelector('.pl-js-iframe')
        .contentWindow.postMessage(obj, panelsViewer.targetOrigin);
    });

    // gather panels from plugins
    Dispatcher.trigger('insertPanels', [
      templateRendered,
      patternPartial,
      iframePassback,
      switchText,
    ]);
  },
};

/**
 * Pattern panel resizer
 * 1) Add mousedown event listener to the modal resizer tab
 * 2) Display block on the modal cover when the panel is being dragged so fast
 * drags can occur.
 * 3) Create mousemove event on the cover since it spans the entire screen and
 * the mouse can be dragged into it without losing resizing
 * 4) Find the new panel height by taking the window height and subtracting the
 * Y-position within the modal cover. Set modal height to this.
 * 5) Add mouseup event to the body so that when drag is released, the modal
 * stops resizing and modal cover doesn't display anymore.
 */
$('.pl-js-modal-resizer').mousedown(function(event) {
  /* 1 */

  $('.pl-js-modal-cover').css('display', 'block'); /* 2 */

  $('.pl-js-modal-cover').mousemove(function(event) {
    /* 3 */
    const panelHeight = window.innerHeight - event.clientY + 32; /* 4 */
    $('.pl-js-modal').css('height', panelHeight + 'px'); /* 4 */

    // WIP: updating PL viewport to be resized via CSS Vars
    // $('.pl-js-modal').css('transition', 'none');
    // $('.pl-js-vp-iframe-container').css('transition', 'none');
    // $('html').css(
    //   '--pl-viewport-height',
    //   window.innerHeight - panelHeight - 32 + 'px'
    // ); /* 4 */
  });
});

$('body').mouseup(function() {
  /* 5 */
  $('.pl-js-modal').unbind('mousemove'); /* 5 */
  $('.pl-js-modal-cover').css('display', 'none'); /* 5 */

  // WIP: updating viewport resizer to use CSS custom props.
  // $('.pl-js-modal').css('transition', '');
  // $('.pl-js-vp-iframe-container').css('transition', '');
});

// Copy to clipboard functionality
let clipboard = new Clipboard('.pl-js-code-copy-btn');
clipboard.on('success', function(e) {
  let copyButton = document.querySelectorAll('.pl-js-code-copy-btn');
  for (let i = 0; i < copyButton.length; i++) {
    copyButton[i].innerText = 'Copy';
  }
  e.trigger.textContent = 'Copied';
});

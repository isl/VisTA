/*
 * Copyright (C) 2015-2017, © Trustees of the British Museum
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, you can receive a copy
 * of the GNU Lesser General Public License from http://www.gnu.org/
 */

import {
  DOM as D,
  Component,
  createFactory,
  MouseEvent,
  ReactElement,
  createElement,
  ReactNode
} from 'react';
import ReactBootstrap = require('react-bootstrap');
import { findDOMNode } from 'react-dom';

import * as _ from 'lodash';

import { MainAppComponent as App } from 'platform/app/app';
import { Rdf } from 'platform/api/rdf';
import * as SecurityService from 'platform/api/services/security';

import { factory as ImportExport } from './import-export';
import { RuleDesc } from './RulesComponent';
import { AligmentRdfLink } from './queries'; //const vars

import '../css/term-align.scss';

import { factory as termAlignmentEdit } from './Alignment_Edit';
//import { factory as termAlignmentView } from './Alignment_View';
import { AlignmentRDF } from './AlignmentRDF';
import { parse } from 'url';
import { ResourceEditorForm } from 'platform/components/forms';

interface Relation {
  title: string;
  iri: Rdf.Iri;
}

export let typeRelation: string;
export let typesRootQuery: string;
export let labelRelation: string;
export let preferredLangs: string[];
export let prefices: string;
//export let parentshipRelation: string;
export let hierarchyRelationOptions: string[];
export let alignedGraphNS: string;
export let infoRelations: string;
export let equalityRelation: string;
export let exactMatchAlignmentRelation: Relation;
export let closeMatchAlignmentRelation: Relation;
export let relatedMatchAlignmentRelation: Relation;
export let broadMatchAlignmentRelation: Relation;
export let broaderAlignmentRelation: Relation;
//ADD-RELATION

interface TreeProps {
  rootsQuery: string;
  childrenQuery: string;
  parentsQuery: string;
  searchQuery: string;
}

interface Props {
  //Important: All template props are used in LOWERCASE
  alignmentrules: string; //{ [key: string]: RuleDesc };//Note: cannot handle this value directly as a JSON one because the \n char is contained in queries
  prefices: string;
  terminologyprefices: { [key: string]: string };
  typerelation: string;
  typesrootquery: string;
  typeschildrenquery: string;
  typesparentquery: string;
  typessearchquery: string;
  //parentshiprelation: string;
  hierarchyrelationoptions: string;
  labelrelation: string;
  preferredlangs?: string[];
  queries: TreeProps;
  alignedgraphns: string;
  inforelations: string;
  equalityrelation: string;
  exactmatchalignmentrelation: { title: string; iri: string };
  closematchalignmentrelation: { title: string; iri: string };
  relatedmatchalignmentrelation: { title: string; iri: string };
  broadmatchalignmentrelation: { title: string; iri: string };
  broaderalignmentrelation: { title: string; iri: string };

  remotesparqlendpoint: string;
  syncgraphversionquery: string;

  //ADD-RELATION
  dropdownlimit?: number;
}

type TabOptions = 'import_export' | 'view' | 'edit';

interface State {
  currentTab: TabOptions;
  currentAlignmentNG: Rdf.Iri;
  currentAlignmentLocked: boolean; //states whether the current graph is locked
  currentAlignmentLockDisabled: boolean; //states whether the current graph can be unlocked by the current user
  currentAlignmentNGLabel: string;
  currentAlignmentSync?: boolean;
  synchronizedGraphs?: Map<string, Rdf.Iri>; //key: old graph, value: new graph
}

class AlignmentTool extends Component<Props, State> {
  private user: Rdf.Iri;
  private terminologyNGprefices: Map<string, string> = new Map<string, string>();

  constructor(props: Props) {
    super(props);
    typeRelation = props.typerelation;
    typesRootQuery = props.typesrootquery;
    labelRelation = props.labelrelation;
    preferredLangs = props.preferredlangs;
    prefices = props.prefices;
    //parentshipRelation = props.parentshiprelation;
    hierarchyRelationOptions = props.hierarchyrelationoptions.split(',').map(item => item.trim()); //convert string to array;
    alignedGraphNS = props.alignedgraphns;
    infoRelations = props.inforelations;
    equalityRelation = props.equalityrelation;
    exactMatchAlignmentRelation = {
      title: props.exactmatchalignmentrelation.title,
      iri: new Rdf.Iri(props.exactmatchalignmentrelation.iri)
    };
    closeMatchAlignmentRelation = {
      title: props.closematchalignmentrelation.title,
      iri: new Rdf.Iri(props.closematchalignmentrelation.iri)
    };
    relatedMatchAlignmentRelation = {
      title: props.relatedmatchalignmentrelation.title,
      iri: new Rdf.Iri(props.relatedmatchalignmentrelation.iri)
    };
    broadMatchAlignmentRelation = {
      title: props.broadmatchalignmentrelation.title,
      iri: new Rdf.Iri(props.broadmatchalignmentrelation.iri)
    };
    broaderAlignmentRelation = {
      title: props.broaderalignmentrelation.title,
      iri: new Rdf.Iri(props.broaderalignmentrelation.iri)
    };
    //ADD-RELATION

    this.state = {
      currentTab: 'import_export', //'edit',
      currentAlignmentNG: undefined,
      currentAlignmentLocked: undefined,
      currentAlignmentLockDisabled: undefined,
      currentAlignmentNGLabel: undefined
    };

    SecurityService.Util.getUser().then(userObject => {
      this.user = new Rdf.Iri(userObject.userURI);
      this.setState({
        currentTab: this.state.currentTab,
        currentAlignmentNG: this.state.currentAlignmentNG,
        currentAlignmentLocked: this.state.currentAlignmentLocked,
        currentAlignmentLockDisabled: this.state.currentAlignmentLockDisabled
      });
    });

    AlignmentRDF.getSchemeGraphs().onValue(ngCollection => {
      //console.log("gCollection"); console.log(ngCollection);
      _.map<Rdf.Iri>(ngCollection.map(item => {
        if (!this.props.terminologyprefices) return;
        this.terminologyNGprefices.set(item["graph"]["value"], this.props.terminologyprefices[item["scheme"]["value"]]);
      }))
    });
  }

  private setStateFunc = (state: State) => {
    //console.log("/////////////////\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\" + "@AlignmentTool state change? " + (this.state == state));
    const prevState = this.state;
    const nextState = state;
    this.setState(state);
  };

  componentDidUpate(prevProps, prevState) {
    //Can call setState: Yes.
    //console.log("componentDidUpate @AlignmentTool component");
    //console.log(prevState);
    // console.log(prevState.currentAlignmentNG);
    // console.log(this.state.currentAlignmentNG);
  }

  componentWillUpdate(nextProps, nextState) {
    //Can call setState: No.
    // console.log("componentWillUpdate @AlignmentTool component");
    // console.log(nextState);
  }

  componentWillUnmount() {
    //Can call setState: No.
    //console.log("componentWillUnmount @AlignmentTool component");
  }

  public render() {
    return D.div(
      { style: { paddingRight: '15px' } }, //this style stops page flickering at the Chrome by the verical-scrollbar appearing/disappearing on a-links mouseover events
      this.renderHeader(),
      this.renderMenu()
    );
  }

  private renderMenu() {
    // we use font-awesome instead of glyphicons
    const Tab = createFactory(ReactBootstrap.Tab);
    const Tabs = createFactory(ReactBootstrap.Tabs);
    const Label = createFactory(ReactBootstrap.Label);

    const graphlink = this.state.currentAlignmentNG
      ? createFactory(ReactBootstrap.Button)({
        id: 'graph_but',
        key: 'graph_but',
        title: 'Show graph',
        className: 'btn btn-default component-page-toolbar__btn_show_graph',
        bsStyle: 'link',
        bsSize: 'sm',
        onClick: () => {
          window.open(
            `/resource/Admin:NamedGraphs?graph=${encodeURIComponent(
              this.state.currentAlignmentNG.value
            )}`,
            'graphViewer'
          );
        }
      })
      : // D.a({
      //     className: "btn btn-default component-page-toolbar__btn_show_graph",
      //     href: `/resource/Admin:NamedGraphs?graph=${encodeURIComponent(this.state.currentAlignmentNG.value)}`,
      //     target: "graphViewer",
      //     title: 'Show Alignment Graph',
      // })
      undefined;

    // const SyncFlag = D.div({
    //   key: 'sync',
    //   className: 'fa fa-wrench',
    //   onClick: () => { this.setStateFunc(_.assign(this.state, { currentAlignmentSync: true })) }
    // })

    const SyncFlag = createFactory(ReactBootstrap.Button)({
      key: 'sync',
      className: 'fa fa-wrench',
      title: 'Click to upgrade the alignment',
      bsStyle: 'link',
      bsSize: 'sm',
      onClick: () => { this.setStateFunc(_.assign(this.state, { currentAlignmentSync: true })) }
    })

    const InfoDiv = D.div(
      { className: 'info-tab' },
      graphlink,
      createFactory(ReactBootstrap.ControlLabel)(
        {
          htmlFor: 'lock_but'
        },
        `Alignment:`
      ),
      D.span(
        { className: 'info-tab-span' },
        `${this.state.currentAlignmentNG}`
      ),
      createFactory(ReactBootstrap.Button)({
        id: 'lock_but',
        key: 'lock_but',
        title: 'Toggle lock',
        className: this.state.currentAlignmentLocked ? 'fa fa-lock' : 'fa fa-unlock',
        bsStyle: 'link',
        bsSize: 'sm',
        disabled: this.state.currentAlignmentLockDisabled,
        onClick: () => {
          AlignmentRDF.toggleAlignmentLocked(
            this.state.currentAlignmentNG,
            this.user,
            (lock: boolean) => {
              //console.log("setState-toggleAlignmentLocked-" + lock);
              this.setStateFunc({
                currentTab: this.state.currentTab,
                currentAlignmentNG: this.state.currentAlignmentNG,
                currentAlignmentLocked: lock,
                currentAlignmentLockDisabled: this.state.currentAlignmentLockDisabled,
                currentAlignmentNGLabel: this.state.currentAlignmentNGLabel
              });
            }
          );
        }
      }),
      (this.state.currentAlignmentNG && this.state.synchronizedGraphs && this.state.synchronizedGraphs.has("" + this.state.currentAlignmentNG.value)) ? SyncFlag : undefined,

      // createFactory(ReactBootstrap.Button)({
      //     id: 'graph_but',
      //     key: 'graph_but',
      //     title: 'Show Alignment Graph',
      //     className: "btn btn-default component-page-toolbar__btn_show_graph",
      //     bsStyle: 'link',
      //     bsSize: 'sm',
      //     disabled: this.state.currentAlignmentLockDisabled,
      //     onClick: () => {
      //         window.open(`./Admin:NamedGraphs?graph=${encodeURIComponent(this.state.currentAlignmentNG.value)}`, "View Graph")
      //     },
      // }),
    );

    const currentAlignmentNGLabelFunc = () =>
      this.state.currentAlignmentNGLabel ? this.state.currentAlignmentNGLabel : '';

    //saves input on Enter pressing
    const InfoDiv2 = D.div(
      { className: 'info-tab2' },
      createFactory(ReactBootstrap.FormGroup)(
        {},
        //graphlink,
        createFactory(ReactBootstrap.ControlLabel)(
          {
            bsClass: 'inline-block margin-right-5',
            htmlFor: 'graphLabel'
          },
          `Label:`
        ),
        createFactory(ReactBootstrap.FormControl)({
          id: 'graphLabel',
          bsClass: 'graph-label-display-view',
          style: { width: '80%' },
          type: 'text',
          placeholder: 'Give a label to the Alignment graph',
          value: currentAlignmentNGLabelFunc(), // this value, by React, is probably treated by reference to a variable, so a single ref var has to be assigned here.
          onChange: this.onChangeLabel_handler.bind(this),
          onFocus: this.onFocusLabel_handler.bind(this),
          onBlur: this.onBlurLabel_handler.bind(this),
          onKeyPress: this.onKeyPressLabel_handler.bind(this)
        })
      ) //FormGroup
    ); //div

    // const active1 = (this.state.currentTab == 'import_export' ? "active" : undefined);
    // const active3 = (this.state.currentTab == 'edit' ? "active" : undefined);

    return D.div(
      { className: 'row' },
      D.div(
        { className: 'col-sm-12' },

        Tabs(
          {
            id: 'alignment-menu',
            defaultActiveKey: 'edit', //'edit','view'
            bsStyle: 'tabs',
            animation: true,
            onSelect: eventKey =>
              this.setStateFunc({
                currentTab: <TabOptions>eventKey,
                currentAlignmentNG: this.state.currentAlignmentNG,
                currentAlignmentLocked: this.state.currentAlignmentLocked,
                currentAlignmentLockDisabled: this.state.currentAlignmentLockDisabled,
                currentAlignmentNGLabel: this.state.currentAlignmentNGLabel
              }),
            activeKey: this.state.currentTab
          },
          Tab(
            { eventKey: 'import_export', title: 'Import/Export' },
            this.state.currentTab == 'import_export' ? this.createImportExportWidget() : undefined
          ), //mounted only when activated
          Tab(
            { eventKey: 'edit', title: this.state.currentAlignmentNG ? 'Edit' : 'Create' },
            this.createEditWidget()
          ), //the Edit widget is always mounted, so to be stateful
          //(this.state.currentAlignmentNG ? Tab({ eventKey: 'info', title: `Loaded alignment graph: ${this.state.currentAlignmentNG}`, disabled: true }) : undefined),
          this.state.currentAlignmentNG ? InfoDiv : undefined,
          this.state.currentAlignmentNG ? InfoDiv2 : undefined,
        )
      )
    );
  }

  private renderHeader() {
    return D.span(
      {},
      D.h2({ style: { display: 'inline-block', paddingLeft: '10px' } }),
      D.h2({ style: { display: 'inline-block' }, className: 'appHeader' }, 'Vis'),
      D.h5({ style: { display: 'inline-block' } }, 'ual'),
      D.h2({ style: { display: 'inline-block' }, className: 'appHeader' }, 'T'),
      D.h5({ style: { display: 'inline-block' } }, 'erminology'),
      D.h2({ style: { display: 'inline-block' }, className: 'appHeader' }, 'A'),
      D.h5({ style: { display: 'inline-block' } }, 'lignment')
    );
  }

  private onChangeLabel_handler = event => {
    const newVal = `${event.currentTarget.value}`;
    this.setStateFunc({
      currentTab: this.state.currentTab,
      currentAlignmentNG: this.state.currentAlignmentNG,
      currentAlignmentLocked: this.state.currentAlignmentLocked,
      currentAlignmentLockDisabled: this.state.currentAlignmentLockDisabled,
      currentAlignmentNGLabel: newVal.length > 0 ? newVal : undefined
    });
  };
  private onFocusLabel_handler = event => {
    event.currentTarget.setAttribute('class', 'graph-label-display-edit');
  };
  private onBlurLabel_handler = event => {
    event.currentTarget.setAttribute('class', 'graph-label-display-view');
  };
  private onKeyPressLabel_handler = event => {
    if (event.charCode == 13) {
      event.target.blur();
      AlignmentRDF.updateGraphLabel(
        this.state.currentAlignmentNG,
        this.state.currentAlignmentNGLabel
      );
    }
  };

  private setSynchronizedGraphs = (ngs: Map<string, Rdf.Iri>) => {
    this.setStateFunc(_.assign(this.state, { synchronizedGraphs: ngs }));
  }

  //Returns the new version of the given ngIRI among the synchronizedGraphs
  private getNewVersionOfSynchronizedGraph = (ngIRI: Rdf.Iri) => {

    if (!this.state.synchronizedGraphs) return new Map<string, Rdf.Iri>();//no synchronized graphs, no new graph version
    const retVal = (ngIRI && this.state.synchronizedGraphs.has(ngIRI.value) ?
      new Map<string, Rdf.Iri>().set(ngIRI.value, this.state.synchronizedGraphs.get(ngIRI.value)) //ng does belong to the set of synchronized graphs
      : undefined //ng does not belong to the set of synchronized graphs
    );
    return retVal;
  }

  //Returns the synchronizedGraphs
  private getSynchronizedGraphs = () => {
    return (this.state.synchronizedGraphs ? this.state.synchronizedGraphs : new Map<string, Rdf.Iri>());
  }

  private setCurrentAlignmentNG = (ng: Rdf.Iri, edit?: boolean) => {
    //This is called on load-new alignment. With 'edit', from graphLinkClass@import-export.ts
    //console.log("setState-setCurrentAlignmentNG-0 " + ng + "  " + edit);
    const currVal = this.state.currentAlignmentNG ? this.state.currentAlignmentNG.value : undefined;
    const newVal = ng ? ng.value : undefined;
    if (currVal != newVal) {
      //console.log("setState-setCurrentAlignmentNG-1");
      AlignmentRDF.getAlignmentGraphLabel(ng).onValue(graphLabel => {
        // console.log("A");
        // console.log(graphLabel);
        AlignmentRDF.isAlignmentLocked(ng).onValue(locked =>
          this.setStateFunc({
            currentTab: edit ? <TabOptions>'edit' : this.state.currentTab,
            currentAlignmentNG: ng,
            currentAlignmentLocked: locked,
            currentAlignmentLockDisabled: false, //No need to query because the user is allowed to create, load and the lock a graph
            currentAlignmentNGLabel: graphLabel ? graphLabel.label.value : undefined,
            synchronizedGraphs: this.state.synchronizedGraphs,
          })
        );
      });
      return;
    }
    if (edit) {
      AlignmentRDF.getAlignmentGraphLabel(ng).onValue(graphLabel => {
        // console.log("B");
        // console.log(graphLabel);
        this.setStateFunc({
          currentTab: edit ? <TabOptions>'edit' : this.state.currentTab,
          currentAlignmentNG: ng,
          currentAlignmentLocked: this.state.currentAlignmentLocked,
          currentAlignmentLockDisabled: this.state.currentAlignmentLockDisabled, //No need to query because the user is allowed to create, load and the lock a graph
          currentAlignmentNGLabel: graphLabel ? graphLabel.label.value : undefined,
          synchronizedGraphs: this.state.synchronizedGraphs,
        });
      });
    }
  };

  private updateCurrentAlignmentNG = (unlockNG: boolean, deleteNG: boolean) => {
    //This is called on a. delete-all alignments and b. unlock-all
    if (unlockNG) {
      //Sets to undefined current alignment
      //console.log("setState-updateCurrentAlignmentNG-1");
      this.setStateFunc({
        currentTab: this.state.currentTab,
        currentAlignmentNG: this.state.currentAlignmentNG,
        currentAlignmentLocked: !unlockNG,
        currentAlignmentLockDisabled: false,
        currentAlignmentNGLabel: this.state.currentAlignmentNGLabel,
        synchronizedGraphs: this.state.synchronizedGraphs,
      });
    } else if (deleteNG) {
      //Sets to undefined current alignment
      //console.log("setState-updateCurrentAlignmentNG-2");
      if (this.state.currentAlignmentNG) {
        AlignmentRDF.isAlignmentLocked(this.state.currentAlignmentNG).onValue(locked => {
          if (!locked)
            this.setStateFunc({
              currentTab: this.state.currentTab,
              currentAlignmentNG: undefined,
              currentAlignmentLocked: undefined,
              currentAlignmentLockDisabled: undefined,
              currentAlignmentNGLabel: undefined,
              synchronizedGraphs: this.state.synchronizedGraphs,
            });
        });
      }
    }
  };

  private createImportExportWidget() {
    const updateGraphTableTrigger =
      '' +
      this.state.currentAlignmentNG +
      '-' +
      this.state.currentAlignmentLocked +
      '-' +
      this.state.currentAlignmentLockDisabled +
      '-' +
      (this.state.synchronizedGraphs ? this.getSynchronizedGraphs().size : "") +
      '';
    //console.log("createImportExportWidget  new prop updateGraphTableTrigger=" + updateGraphTableTrigger);
    return D.div(
      { className: 'col-sm-12' },
      createElement(ImportExport, {
        user: this.user,
        updateGraphTableTrigger: updateGraphTableTrigger,
        //limit: this.props.dropdownlimit,
        updateCurrentAlignmentNG: this.updateCurrentAlignmentNG,
        setCurrentAlignmentNG: this.setCurrentAlignmentNG.bind(this),
        remoteSparqlEndpoint: this.props.remotesparqlendpoint,
        syncGraphVersionQuery: this.props.syncgraphversionquery,
        setSynchronizedGraphs: this.setSynchronizedGraphs.bind(this),
        getSynchronizedGraphs: this.getSynchronizedGraphs.bind(this),
      })
    );
  }

  private createEditWidget() {
    return D.div(
      { className: 'col-sm-12' },
      termAlignmentEdit({
        user: this.user,
        prefices: this.props.prefices,
        get_terminology_prefices: this.get_terminology_prefices.bind(this),
        typeRelation: this.props.typerelation,
        typesRootQuery: this.props.typesrootquery,
        typesChildrenQuery: this.props.typeschildrenquery,
        typesParentQuery: this.props.typesparentquery,
        typesSearchQuery: this.props.typessearchquery,
        //parentshipRelation: this.props.parentshiprelation,
        hierarchyRelationOptions: hierarchyRelationOptions,
        labelRelation: this.props.labelrelation,
        preferredLangs: this.props.preferredlangs,
        queries: this.props.queries,
        setCurrentAlignmentNG: this.setCurrentAlignmentNG,
        exactMatchAlignmentRelation: exactMatchAlignmentRelation,
        closeMatchAlignmentRelation: closeMatchAlignmentRelation,
        relatedMatchAlignmentRelation: relatedMatchAlignmentRelation,
        broadMatchAlignmentRelation: broadMatchAlignmentRelation,
        broaderAlignmentRelation: broaderAlignmentRelation,
        //ADD-RELATION
        graphSelectorLimit:
          this.props.dropdownlimit && this.props.dropdownlimit > 0 ? this.props.dropdownlimit : 10,
        loadAlignmentID: this.state.currentAlignmentNG,
        alignmentRules: _.map(
          this.props.alignmentrules,
          x => {
            //console.log(x);
            return <RuleDesc>_.assign(
              {},
              {
                query: x['query'].replace(/\n/g, '\\\\n'),
                queryType: x['queryType'],
                msg: x['msg'],
                msgType: x['msgType'],
                askExitFlag: x['askExitFlag'],
                minCountExitFlag: x['minCountExitFlag'],
                bindings: x['bindings'] ? x['bindings'].split(',').map(x => x.trim()) : undefined
              }
            )
          }
        ),
        getNewVersionOfSynchronizedGraph: this.getNewVersionOfSynchronizedGraph.bind(this),
        currentAlignmentSyncNotificationFunc: this.state.currentAlignmentSync ?
          (() => {
            //reset
            this.setStateFunc(_.assign(this.state, { currentAlignmentSync: false }))
          }).bind(this) : undefined,
      })
    );
  }

  private get_terminology_prefices(ng: Rdf.Iri): string {
    return this.terminologyNGprefices ? this.terminologyNGprefices.get(ng.value) : undefined;
  }
} //class

export type component = AlignmentTool;
export const component = AlignmentTool;
export const factory = createFactory(component);
export default component;

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

//import { DOM as D, Component, createFactory, MouseEvent, ReactElement, createElement, ReactNode } from 'react';
import { DOM as D, Component, createFactory, ReactNode, ReactElement, createElement } from 'react';
import _ = require('lodash');
import { RdfUpload } from 'platform/components/admin/rdf-upload/RdfUpload';
//import { GraphActionLink } from 'platform/components/admin/rdf-upload/GraphActionLink';
import { ResourceLinkComponent as ResourceLink } from 'platform/api/navigation/components/ResourceLinkComponent';
import { RDFGraphStoreService } from 'platform/api/services/rdf-graph-store';
import { serialize } from 'platform/api/rdf/formats/turtle';
import { List } from 'immutable';
import { MainAppComponent as App } from 'platform/app/app';
import {
  DropdownButton,
  SplitButton,
  MenuItem,
  Button,
  Modal,
  ButtonGroup,
  ButtonToolbar,
  FormGroup,
  ControlLabel,
  FormControl,
  Alert
} from 'react-bootstrap';
import { Rdf } from 'platform/api/rdf';
import { refresh, getCurrentResource, getCurrentUrl } from 'platform/api/navigation';
import { SparqlUtil, SparqlClient } from 'platform/api/sparql';

import { SemanticQuery } from 'platform/components/semantic/query/SemanticQuery';
import { SemanticTable } from 'platform/components/semantic/table/SemanticTable';
//import { TemplateItem } from 'platform/components/ui/template/TemplateItem';
import { queriesTemplates, AligmentRdfLink } from './queries'; //const vars
import { AlignmentRDF } from './AlignmentRDF';
import { OverlayDialogs } from './OverlayDialogs';

import '../css/term-align.scss';

const FormGroupF = createFactory(FormGroup);
//const ButtonF = createFactory(Button);
//const ControlLabelF = createFactory(ControlLabel);
//const FormControlF = createFactory(FormControl);
//const DropdownButtonF = createFactory(DropdownButton);
//const MenuItemF = createFactory(MenuItem);

const options = serialize.Format; //Rdf formats

let listOfFormatOptions: ReactNode[] = []; //init

interface Props {
  user: Rdf.Iri;
  //limit?: number;//not used
  updateGraphTableTrigger: string;
  updateCurrentAlignmentNG?: (unlockNG: boolean, deleteNG: boolean) => void;
  setCurrentAlignmentNG?: (ng: Rdf.Iri, edit?: boolean) => void;
  remoteSparqlEndpoint?: string;
  syncGraphVersionQuery?: string;
  setSynchronizedGraphs?: (ngs: Map<string, Rdf.Iri>) => void;
  getSynchronizedGraphs?: () => Map<string, Rdf.Iri>;
};

interface State {
  format: string;
  deleteAllDisable: boolean;
  unlockAllDisable: boolean;
  unlockCurrent?: boolean;
  hiliteRelatedGraphs?: any;
}


const triplesCount_cellTemplate = (graph?: string) => {
  if (!graph) graph = "{{graph.value}}";
  return `<semantic-query query="SELECT ?size WHERE{ {SELECT (COUNT(*) as ?number) WHERE{ GRAPH <${graph}>{ { SELECT * WHERE{ ?s ?p ?o}  LIMIT 1000 } } } LIMIT 1} BIND(IF(?number>=1000, &apos;>=1000&apos;, ?number) as ?size)}"></semantic-query>`
}
const exportGraph_cellTemplate = (graph?: string) => {
  if (!graph) graph = "{{graph.value}}";
  return `
  <bs-dropdown-button id=\"download\" bs-size=\"xsmall\" title=\"\" class=\"mp-rdf-graph-action__download-dropdown\" no-caret=\"true\">
    <bs-menu-item event-key=1>
      <mp-graph-store-action title=\"Download\" action=\"GET\" graphuri=\"${graph}\" file-ending=\"trig\" class=\"mp-rdf-graph-action__download-dropdown-item\">TRIG</mp-graph-store-action>
    </bs-menu-item>
    <bs-menu-item event-key=2>
      <mp-graph-store-action title=\"Download\" action=\"GET\" graphuri=\"${graph}\" file-ending=\"ttl\" class=\"mp-rdf-graph-action__download-dropdown-item\">TURTLE</mp-graph-store-action>
    </bs-menu-item>
  <bs-menu-item event-key=3>
      <mp-graph-store-action title=\"Download\" action=\"GET\" graphuri=\"${graph}\" file-ending=\"nt\" class=\"mp-rdf-graph-action__download-dropdown-item\">NTRIPLES</mp-graph-store-action>
    </bs-menu-item>
  <bs-menu-item event-key=4>
      <mp-graph-store-action title=\"Download\" action=\"GET\" graphuri=\"${graph}\" file-ending=\"rdf\" class=\"mp-rdf-graph-action__download-dropdown-item\">RDF/XML</mp-graph-store-action>
    </bs-menu-item>
    <bs-menu-item event-key=4>
      <mp-graph-store-action title=\"Download\" action=\"GET\" graphuri=\"${graph}\" file-ending=\"owl\" class=\"mp-rdf-graph-action__download-dropdown-item\">OWL</mp-graph-store-action>
    </bs-menu-item>
  </bs-dropdown-button>`
}

const deleteGraph_cellTemplate = (graph?: string) => {
  if (!graph) graph = "{{graph.value}}";
  return `<mp-graph-store-action title = "Delete" data-action="DELETE" data-graphuri="${graph}" > <i class="fa fa-trash-o" > </i></mp-graph-store-action>`
}

const deleteGraph_disabled_cellTemplate = () => `<i class="fa fa-trash-o  disabled"> </i>`

const deleteGraph_dialog_cellTemplate = (graph?: string, graphLabel?: string) => {
  if (!graph) graph = "{{graph.value}}";
  if (!graphLabel) graphLabel = "{{graphLabel.value}}";
  return `
  <mp-overlay-dialog title="Delete graph" type="modal" bs-size="large"  data-show="true">
    <mp-overlay-dialog-trigger><i class=\"fa fa-trash-o  mp-rdf-graph-action\"></i></mp-overlay-dialog-trigger>
    <mp-overlay-dialog-content>
        Are you sure you want to delete graph: <i class="term-info-label">{{#ifCond graphLabel.value "==" ""}}${graph}{{else}}${graphLabel}&nbsp;(${graph}){{/ifCond}}</i>&nbsp;?&nbsp;&nbsp;
        <mp-graph-store-action title="DELETE" data-action="DELETE" data-graphuri="${graph}"><button class="btn btn-success">Yes, sure!</button></mp-graph-store-action>
        <!-- It's impossible to add <button class="close" aria-label="Close"><span aria-hidden="true">No</span></button> -->
    </mp-overlay-dialog-content>
  </mp-overlay-dialog>
  `
}

const graphLink_cellComponent = (onClick: (ng: Rdf.Iri, edit: boolean) => void, currentUser: Rdf.Iri, syncButtonNode?: (g: string) => ReactNode) =>
  class GraphLink2 extends Component<any, any> {
    private currentUser = currentUser ? currentUser.value : '';
    constructor(props) {
      super(props);
    }
    render() {//this.props['rowData'] refers to the context of the current row that calls this function
      const ng: Rdf.Iri = new Rdf.Iri(this.props['rowData'].graph.value);
      const rowUser: string = this.props['rowData'].user ? this.props['rowData'].user.value : '';

      //Graph label
      const displayNG: string =
        this.props['rowData'].graphLabel && this.props['rowData'].graphLabel.value.length > 0
          ? this.props['rowData'].graphLabel.value
          : '' + ng;

      //Graph link
      const graphLink = onClick ? D.a(
        {
          title: this.props['data'],
          onClick: () => onClick(ng, true)
        },
        displayNG) // this.props["rowData"].graph.value //
        :
        displayNG;

      //Graph symbol
      const viewGraph = D.a({
        className: 'btn btn-default component-page-toolbar__btn_show_graph',
        href: `/resource/Admin:NamedGraphs?graph=${encodeURIComponent(ng.value)}`,
        target: 'graphViewer',
        title: ng.value
      });

      //Sync symbol
      const synchGraph = (syncButtonNode ? syncButtonNode(this.props["rowData"].graph.value) : undefined);

      return (!Boolean(rowUser) || rowUser == this.currentUser)
        ? /*activate link*/
        D.div(
          {},
          viewGraph,
          graphLink,
          synchGraph,
        )
        : /*deactivate link*/ D.div({ style: { fontStyle: 'italic' } }, viewGraph, displayNG, synchGraph); // this.props["rowData"].graph.value
    }
  };

const graphLink_cellComponent_alingmentNG = (onClick: (ng: Rdf.Iri, edit: boolean) => void, currentUser: Rdf.Iri, syncButtonNode?: (g: string) => ReactNode) =>
  class GraphLink2 extends Component<any, any> {
    private currentUser = currentUser ? currentUser.value : '';
    constructor(props) {
      super(props);
    }
    render() {//this.props['rowData'] refers to the context of the current row that calls this function
      const ng: Rdf.Iri = new Rdf.Iri(this.props['rowData'].graph.value);
      const rowUser: string = this.props['rowData'].user ? this.props['rowData'].user.value : '';

      //Graph label
      const displayNG: string =
        this.props['rowData'].graphLabel && this.props['rowData'].graphLabel.value.length > 0
          ? this.props['rowData'].graphLabel.value
          : '' + ng;

      //Graph link
      const graphLink = onClick ? D.a(
        {
          title: this.props['data'],
          onClick: () => onClick(ng, true)
        },
        displayNG) // this.props["rowData"].graph.value //
        :
        displayNG;

      //Graph symbol
      const viewGraph = D.a({
        className: 'btn btn-default component-page-toolbar__btn_show_graph',
        href: `/resource/Admin:NamedGraphs?graph=${encodeURIComponent(ng.value)}`,
        target: 'graphViewer',
        title: ng.value
      });

      //Sync symbol
      const synchGraph = (syncButtonNode ? syncButtonNode(this.props["rowData"].graph.value) : undefined);

      return (!Boolean(rowUser) || rowUser == this.currentUser)
        ? /*activate link*/
        D.div(
          {},
          viewGraph,
          graphLink,
          synchGraph,
          D.div({ className: "alignment-graph-info" }, "s: ", this.props["rowData"].sourceNG.value),
          D.div({ className: "alignment-graph-info" }, "t: ", this.props["rowData"].targetNG.value),
        )
        : /*deactivate link*/ D.div({ style: { fontStyle: 'italic' } }, viewGraph, displayNG, synchGraph); // this.props["rowData"].graph.value
    }
  };

class ImportExport extends Component<Props, State> {
  constructor(props) {
    super(props);
    let initFormat;

    // for (let k in options) {
    //     if (!initFormat) {
    //         initFormat = options[k]
    //     }
    //     if (options.hasOwnProperty(k)) {
    //         listOfFormatOptions.push(D.option({ value: options[k] }, k));
    //     }
    // }

    this.state = { format: initFormat, deleteAllDisable: true, unlockAllDisable: true };
  }

  private setStateFunc = (state: State) => {
    //console.log("/////////////////\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\" + "@import/export state change? " + (this.state == state));
    const prevState = this.state;
    const nextState = state;
    this.setState(state);
  };

  //componentWillUpdate() {
  componentDidMount() { //logs many warnings
    //console.log("componentDidMount @import/export");
    this.updateTableButtonStates();
  }
  // componentWillMount(){
  //     console.log("componentWillMount @import/export");
  // }

  updateTableButtonStates() {
    //console.log("updateTableButtonStates @import/export");

    /* Rules for unlock/delete
            Only the unlocked graphs are deletable (by any user)
            The locked graphs can be unlocked only by the owner
        */
    AlignmentRDF.getUnlockedAlignmentGraphs('graph') //estimate whether there are deletable graphs in order to enable the deleteAll-button
      .onValue(res => {
        if (this.props.user)
          AlignmentRDF.getAlignmentsLockedByUser(this.props.user) //estimate whether there are unlockable graphs in order to enable the unlockAll-button
            .onValue(res2 => {
              this.setStateFunc({
                format: this.state.format,
                deleteAllDisable: res.length == 0,
                unlockAllDisable: res2.length == 0
              });
            });
      });
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    //console.log("componentWillReceiveProps @import/export");
    if (nextProps.updateGraphTableTrigger == this.props.updateGraphTableTrigger) return;
    this.updateTableButtonStates(); // to update tables that need to be refreshed
  }

  shouldComponentUpdate(nextProps, nextState) {
    //console.log("shouldComponentUpdate @import/export");
    if (
      nextProps.updateGraphTableTrigger != this.props.updateGraphTableTrigger ||
      nextState != this.state
    )
      return true;
    return false;
  }

  //componentDidUpdate(prevProps, prevState) {
  //console.log("componentDidUpdate @import/export");
  //console.log(this.props.synchronizedGraphs);
  //     console.log("props changed? " + (prevProps == this.props) + " state changed" + (prevState == this.state));

  //     //     if (prevState.deleteAllDisable == this.state.deleteAllDisable &&
  //     //         prevState.unlockAllDisable == this.state.unlockAllDisable) return;

  //     //     if (prevState != this.state) {
  //     //         console.log("state changed");
  //     //         console.log(prevState);
  //     //         console.log(this.state);
  //     //     }
  //     //     this.updateTableButtonStates();// to update tables that need to be refreshed
  //}

  render() {
    //console.log("render  @import/export");
    return D.div(
      { className: 'row' },
      D.div(
        {}, //{ className: "col-sm-12" },
        this.renderImport()
      ),

      D.div({ className: 'col-sm-5' }, this.renderTerminologyGraphs()),

      D.div({ className: 'col-sm-7' }, this.renderAlignmentGraphs())
    );
  }

  renderImport() {
    const FormGroup = FormGroupF({ controlId: 'formControlsSelect', bsClass: 'select-rdf-format' });

    return D.div(
      { className: 'col-sm-12' },
      D.div(
        {
          className: 'row top20 padLeft20'
        },
        D.b({}, 'Import terminology')
      ),
      D.div({
        className: 'row top20'
      }),
      FormGroup,
      createElement(RdfUpload, {
        config: {
          description: '',
          method: '',
          //contentType: this.state.format
          contentType: undefined
        }
      })
    );
  }

  // handleClick = function (event) {
  //     this.setStateFunc({ format: event.currentTarget.value, deleteAllDisable: this.state.deleteAllDisable });
  // }

  renderAlignmentGraphs() {
    const alignmentLink = AligmentRdfLink();

    return D.div(
      { className: 'col-sm-12' },
      D.div(
        {
          className: 'row top20 padLeft20'
        },
        D.b({}, 'Alignments')
      ),
      D.div({
        className: 'row top20'
      }),
      createElement(SemanticQuery, {
        key: 'semQr2_' + this.state.deleteAllDisable,
        query: queriesTemplates.selectGraphByPredicate_size(alignmentLink),
        template:
          '{{#each bindings}}{{#ifCond number.value ">=" 1000}}<bs-alert bs-style="warning"> The following table is limited to show only <strong>1000</strong> named graphs.</bs-alert> {{else}} <bs-alert bs-style="info"> The repository contains <strong>{{size.value}}</strong> distinct Alignment graph(s).</bs-alert> {{/ifCond}}{{/each}}'
      }),
      createElement(SemanticTable, {
        key:
          'semTbl2_' +
          this.props.updateGraphTableTrigger +
          '-' +
          this.state.unlockAllDisable +
          '-' +
          this.state.deleteAllDisable, //triggers table refresh
        query: queriesTemplates.selectAlignmentGraphsPerUser(
          'graph',
          'graphLabel',
          'sourceNG',
          'targetNG',
          'user',
          'creator',
          'creationDate',
          'modificationDate'
        ),
        numberOfDisplayedRows: 15,
        columnConfiguration: this.alignmentGraphsColumnConfigurationFunc()
      }),
      D.div(
        { className: 'col-sm-12 footer-row' },

        D.div(
          { className: 'float-right' },
          createFactory(Button)({
            title: 'Unlock all owned alignment graphs',
            className: 'fa fa-unlock',
            disabled: this.state.unlockAllDisable,
            onClick: () => {
              this.showDialog('unlockAll_OverlayDialog', this.unlockAll_OverlayDialog);
            }
          }),
          createFactory(Button)({
            title: 'Delete all alignment graphs',
            className: 'fa fa-trash-o',
            disabled: this.state.deleteAllDisable,
            onClick: () => {
              this.showDialog('deleteAll_OverlayDialog', this.deleteAll_OverlayDialog);
            }
          })
        )
      )
    );
  }

  alignmentGraphsColumnConfigurationFunc = () => {

    let conf = [
      {
        //variableName: "graph", displayName: "Alignment Graph", cellTemplate: '<text>{{graph.value}}</text>'
        variableName: 'graph',
        displayName: 'Alignment Graph',
        cellComponent: graphLink_cellComponent_alingmentNG(this.props.setCurrentAlignmentNG, this.props.user, this.syncGraphButton)
      },
      {
        displayName: 'Triples',
        cellTemplate: triplesCount_cellTemplate()
      },
      {
        variableName: 'user',
        displayName: 'Locked by',
        cellTemplate: '{{#ifCond user.value "!==" ""}} <mp-label iri="{{user.value}}"</<mp-label>{{/ifCond}}'
      },
      {
        variableName: 'creator',
        displayName: 'Created by',
        cellTemplate: '{{#ifCond creator.value "!==" ""}} <mp-label iri="{{creator.value}}"</<mp-label>{{/ifCond}}'
      },
      {
        variableName: 'creationDate',
        displayName: 'Created on',
        cellTemplate: '{{#ifCond creationDate.value "!==" ""}} <span><sm>{{creationDate.value}}</sm></span>{{/ifCond}}'
      },
      {
        displayName: 'Actions',
        cellTemplate: `<div>${exportGraph_cellTemplate()} 
        {{#ifCond user.value \"==\" \"\"}}
          ${deleteGraph_dialog_cellTemplate()} 
        {{else}} 
        {{#ifCond user.value \"==\" \"${this.props.user ? this.props.user.value : undefined}\"}}
          &nbsp;${deleteGraph_dialog_cellTemplate()}
        {{else}} 
          ${deleteGraph_disabled_cellTemplate()}
        {{/ifCond}}
        {{/ifCond}}
        <div>`
      },
    ];
    return conf;
  }

  renderTerminologyGraphs() {
    const alignmentLink = AligmentRdfLink();

    return D.div(
      { className: 'col-sm-12' }, //TODO: Create a Row is better than Column
      D.div(
        {
          className: 'row top20 padLeft20'
        },
        D.b({}, 'Terminologies'),
        (this.props.remoteSparqlEndpoint ?
          createFactory(Button)({
            title: 'Click to detect any new versions of terminology graphs and the affected alignments',
            className: 'margin-left-5 fa fa-wrench',
            block: false,
            // bsStyle: 'primary',
            onClick: () => this.showDialog("syncTerminologies_OverlayDialog", this.syncTerminologies_OverlayDialog())
          })
          : undefined)
      ),
      D.div({
        className: 'row top20'
      }),

      createFactory(SemanticQuery)({
        query: queriesTemplates.selectGraphByPredicate_size(
          new Rdf.Iri('http://www.w3.org/2004/02/skos/core#inScheme')
        ),
        template:
          '{{#each bindings}}{{#ifCond number.value ">=" 1000}}<bs-alert bs-style="warning"> The following table is limited to show only <strong>1000</strong> named graphs.</bs-alert> {{else}} <bs-alert bs-style="info"> The repository contains <strong>{{size.value}}</strong> distinct Terminology graph(s).</bs-alert> {{/ifCond}}{{/each}}'
      }),
      createFactory(SemanticTable)({
        query: queriesTemplates.selectSchemeGraphs(),
        numberOfDisplayedRows: 15,
        columnConfiguration: this.termGraphsColumnConfigurationFunc(),
      })
    );
  }

  termGraphsColumnConfigurationFunc = () => {
    let conf = [
      {
        key: 1,
        variableName: 'graph',
        displayName: 'Terminology Graph',
        cellComponent: graphLink_cellComponent(undefined, this.props.user, this.syncGraphButton)

        //variableName: "graph", displayName: "Terminology Graph", cellTemplate: '<mp-label  iri="{{graph.value}}" />' ,
        //variableName: "graph", displayName: "Terminology Graph", cellTemplate: "<text>{{graph.value}}</text>"
      },
      {
        key: 2,
        displayName: 'Triples',
        cellTemplate: triplesCount_cellTemplate()
      },
      {
        key: 3,
        displayName: 'Actions',
        cellTemplate: `<div>${exportGraph_cellTemplate()}&nbsp;${deleteGraph_cellTemplate()}</div`
      },
    ];
    return conf;
  }


  //General method
  showDialog = (dialogKey: string, dialog: React.ReactElement<any>) => {
    //getOverlaySystem().show(dialogKey, dialog);
    OverlayDialogs.showDialog(dialogKey, dialog);
  };

  //Appears next to unsynchronized graphs
  syncGraphButton = (graph) => {
    const synchronizedGraphs = this.props.getSynchronizedGraphs();
    return (synchronizedGraphs && synchronizedGraphs.has(graph)) ?
      D.div({ //createFactory(Button)({
        className: 'fa fa-wrench',
        //onClick: () => this.showDialog("syncTerminology_OverlayDialog", this.syncTerminology_OverlayDialog(graph))
      }) :
      undefined;
  }

  deleteAll_OverlayDialog: ReactElement<any> = OverlayDialogs.create_yes_no_OverlayDialog(
    "deleteAll_OverlayDialog", "Delete All Unlocked Alignments", "Are you sure you want to delete all unlocked alignments?",
    () => {
      const funcAfterDelete = () => {
        //update parent class component
        if (this.props.updateCurrentAlignmentNG) {
          this.props.updateCurrentAlignmentNG(undefined, true);
        }
        this.setStateFunc({
          format: this.state.format,
          deleteAllDisable: true,
          unlockAllDisable: this.state.unlockAllDisable
        });
      };
      AlignmentRDF.deleteAllAlignments(funcAfterDelete);
    },
  );

  unlockAll_OverlayDialog: ReactElement<any> = OverlayDialogs.create_yes_no_OverlayDialog(
    "unlockAll_OverlayDialog", "Unlock All Owned Alignments", "Are you sure you want to unlock all your owned alignments?",
    () => {
      const funcAfterUnlock = () => {
        //update parent class component
        if (this.props.updateCurrentAlignmentNG) {
          this.props.updateCurrentAlignmentNG(true, undefined);
        }
      };
      AlignmentRDF.unlockAlignmentsByUser(this.props.user, funcAfterUnlock);
    }
  );


  syncTerminologies_OverlayDialog: () => ReactElement<any> = () => {

    const syncTerminologiesFunc = () => {

      const syncVersions: Map<string, Rdf.Iri> = new Map<string, Rdf.Iri>();//Holds <scheme:newestVersionGraph>
      const syncNGraphs: Map<string, Rdf.Iri> = (this.props.getSynchronizedGraphs ? this.props.getSynchronizedGraphs() : new Map<string, Rdf.Iri>());//Holds <oldGraph:newGraph> (only if any updates)

      AlignmentRDF.getSchemeGraphs().onValue(ngSchemeCollection => {
        //console.log("gCollection"); console.log(ngCollection);
        _.map<Rdf.Iri>(ngSchemeCollection.map(item => item["scheme"]))

          /* Process PER SCHEMA */

          .map((schemeIri: Rdf.Iri) => {
            //syncGraphVersionQuery selects <?ng  ?created ?modified  ?ngCreated> for a given resource
            const query = this.props.syncGraphVersionQuery.replace(/__resource__/g, schemeIri.toString());
            //console.log(query);

            AlignmentRDF.selectQuery(query)
              .map(result => _.map(result.results.bindings

                /* Process PER NAMED GRAPH IN THE CONTEXT OF THE CURRENT SCHEMA schemeIri */
                .map(binding => ({
                  newversion: binding["ng"],
                }))
              )).onValue(res => {
                if (!syncVersions.has(schemeIri.value)) syncVersions.set(schemeIri.value, <Rdf.Iri>res[0]["newversion"]);

                //Set up the map for the graph Updates to be done
                ngSchemeCollection.map((item) => {
                  const g1: string = item["graph"]["value"];//the old graph
                  const sch: string = item["scheme"]["value"];
                  const g2: string = (syncVersions && syncVersions.get(sch)) ? syncVersions.get(sch).value : undefined;//the new graph

                  if (g2 && g1 != g2) {
                    syncNGraphs.set(g1, new Rdf.Iri(g2));
                    AlignmentRDF.selectAlignmentGraphsBySourceOrTarget("graph", new Rdf.Iri(g1))
                      .onValue(res2 => {
                        if (res2) res2
                          .forEach((algnmntNG) => {
                            syncNGraphs.set(algnmntNG["graph"]["value"], undefined);
                          })
                        this.props.setSynchronizedGraphs(syncNGraphs);
                      })
                  }
                });
              });
          }); console.log("ngCollection ", ngSchemeCollection);
      }); console.log("syncNGraphs ", syncNGraphs);
    }
    return OverlayDialogs.create_yes_no_OverlayDialog(
      "syncTerminologies_OverlayDialog", "Synchronize All Terminologies", "Are you sure you want to synchronize all terminologies?",
      syncTerminologiesFunc,
    )
  };



} //class

export const factory = createFactory(ImportExport);
//export default ImportExport;


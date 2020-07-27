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

import { DOM as D, Component, ReactElement, createFactory, createElement, } from 'react';
import ReactBootstrap = require('react-bootstrap');
import {
   Button,
   Nav, NavItem, Alert,
   MenuItem,
} from 'react-bootstrap';
import * as _ from 'lodash';
import { List } from 'immutable';
import { Rdf } from 'platform/api/rdf';
import { Node } from 'platform/components/semantic/lazy-tree/NodeModel';
import { Dictionary } from 'ontodia';
import { OverlayDialogs } from './OverlayDialogs';
import { KefirComponentBase } from 'platform/components/utils';

export type RuleDesc = {
   query: string;
   queryType: "ask" | "select";
   msg: string;
   msgType: "warning" | "danger";
   askExitFlag?: boolean;     //for ASK queries
   minCountExitFlag?: number     //for SELECT queries
   bindings?: string[];       //for SELECT queries
}

interface Relation {
   title: string
   iri: Rdf.Iri
}

interface Props {
   rules: RuleDesc[];
   sourceTerm: Node;
   targetTerm: Node;
   alignmentNG: Kefir.Property<Rdf.Iri>;
   sourceNG: Rdf.Iri;
   targetNG: Rdf.Iri;

   prefices: string;
   labelRelation: string;
   hierRelSource: string;
   hierRelTarget: string;
   hierRelAlignment: string;

   exactMatchAlignmentRelation: Relation;
   closeMatchAlignmentRelation: Relation;
   relatedMatchAlignmentRelation: Relation;
   broadMatchAlignmentRelation: Relation;

   onSelectRelationFunc: (...any) => void;
   onSelectOption_onlySubTerms_Func: (...any) => void;
   onAlertExceptionFunc: (...any) => void;
   onCloseDialogFunc: (...any) => void;

   askQueryFunc: (query: string) => Kefir.Property<any>;
   selectQueryFunc: (query: string) => Kefir.Property<any>;
   selectQueryResult: (queryResult: Kefir.Property<any>) => Kefir.Property<{ [key: string]: Rdf.Node }[]>;
}

interface State {
   dialog: ReactElement<any>;
}

export class RulesComponent extends Component<Props, State> {

   constructor(props: Props) {
      super(props);
      this.state = { dialog: undefined }
   }

   private resetDialog() { this.setState({ dialog: undefined }) }

   componentDidMount() {
      //console.log("componentDidMount @RulesComponent");
      this.props.alignmentNG.onValue(NGIri => {
         this.recursiveRules(this.props.rules, NGIri, []);
      })
   }

   render() {
      return D.div({}, (this.state.dialog) ? this.state.dialog : undefined);
   }

   recursiveRules(rules: RuleDesc[], NGIri: Rdf.Iri, messageAggregatorArr?: any[]) {
      const rule = rules[0];// current rule is the first one

      const sourceTermTitle = (this.props.sourceTerm["label"] ? this.props.sourceTerm["label"].value : this.props.sourceTerm["iri"].value);
      const targetTermTitle = (this.props.targetTerm["label"] ? this.props.targetTerm["label"].value : this.props.targetTerm["iri"].value);
      const dialogKey = 'relation-selection';
      const counter = rules.length;
      const sourceElement = (k) => createElement("b", { key: "bSrcTitle" + counter + "-" + k }, sourceTermTitle);
      const targetElement = (k) => createElement("b", { key: "bTrgTitle" + counter + "-" + k }, targetTermTitle);

      const prefices = this.props.prefices;
      const labelRelation = this.props.labelRelation;
      const sourceTermIRI = this.props.sourceTerm["iri"];
      const targetTermIRI = this.props.targetTerm["iri"];

      const sourceNG = this.props.sourceNG;
      const targetNG = this.props.targetNG;

      const hierRelSource = this.props.hierRelSource;
      const hierRelTarget = this.props.hierRelTarget;
      const hierRelAlignment = this.props.hierRelAlignment;
      const exactMatchAlignmentRelation = this.props.exactMatchAlignmentRelation.iri;
      const closeMatchAlignmentRelation = this.props.closeMatchAlignmentRelation.iri;
      const relatedMatchAlignmentRelation = this.props.relatedMatchAlignmentRelation.iri;
      const broadMatchAlignmentRelation = this.props.broadMatchAlignmentRelation.iri;

      const askQueryFunc = this.props.askQueryFunc;
      const selectQueryFunc = this.props.selectQueryFunc;
      const selectQueryResult = this.props.selectQueryResult;


      /* step 1. Substitute the respective placeholders with the iris */
      const ruleQuery: string = rule.query
         .replace(/__prefices__/g, prefices)
         .replace(/__sourceTerm__/g, sourceTermIRI.toString())
         .replace(/__targetTerm__/g, targetTermIRI.toString())
         .replace(/__exactMatchAlignmentRelation__/g, exactMatchAlignmentRelation.toString())
         .replace(/__closeMatchAlignmentRelation__/g, closeMatchAlignmentRelation.toString())
         .replace(/__relatedMatchAlignmentRelation__/g, relatedMatchAlignmentRelation.toString())
         .replace(/__broadMatchAlignmentRelation__/g, broadMatchAlignmentRelation.toString())
         .replace(/__hierarchyRelations.source__/g, hierRelSource)
         .replace(/__hierarchyRelations.target__/g, hierRelTarget)
         .replace(/__hierRelAlignment__/g, hierRelAlignment)
         .replace(/__alignmentNG__/g, NGIri.toString())
         .replace(/__sourceNG__/g, sourceNG.toString())
         .replace(/__targetNG__/g, targetNG.toString())
         .replace(/__labelRelation__/g, labelRelation);
      //console.log(ruleQuery);

      /* step 2. Tokenize the message sentence in parts to insert between them the "sourceElement" */
      let messageList: List<any> = rule.msg.split(/__sourceTerm__/).reduce((total, item, i) => {

         /* step 3. Tokenize item, in parts, to insert between them the "targetElement" */
         let total2 = item.split(/__targetTerm__/).reduce((total2, item2, j) => {
            total2 = total2.push(item2).push((item2.length > 0 && item.includes(item2 + "__targetTerm__") ? targetElement(j) : ""));
            return total2;
         }, List<any>());
         total2.filter(w => typeof w != "string" || w.length > 0).forEach(w => total = total.push(w));//flattens total2 into total
         total = total.push((item.length > 0 && rule.msg.includes(item + "__sourceTerm__") ? sourceElement(i) : ""));
         return total;
      }, List<any>());

      /* step 4. Final result. */
      let messageArr: Array<any> = messageList.toArray();//convert List2Array

      /* step 5. Query to check rule.  */

      let evalQuery: Kefir.Property<any>;

      if (rule.queryType == "ask") evalQuery = askQueryFunc(ruleQuery)
      else if (rule.queryType == "select") {
         evalQuery = selectQueryResult(selectQueryFunc(ruleQuery));
      }


      evalQuery.onValue(resultQ => {

         //console.log("evalQuery.onValue", rule.queryType, rule.msgType, resultQ, messageArr, rule.msgType);

         //ASK-DANGER
         if (rule.queryType == "ask" && rule.msgType == 'danger' && ("" + rule.askExitFlag == "" + resultQ)) {//NO-PASS (DANGER)
            this.setState({ dialog: this.createRelationDialog(this.props.sourceTerm, this.props.targetTerm, messageArr, rule.msgType) })
            return;

            //TODO: SELECT-DANGER
         } else if (rule.queryType == "select" && rule.msgType == 'danger' && (rule.minCountExitFlag <= resultQ.length)) {//NO-PASS (DANGER)
            //console.log("SELECT-DANGER", resultQ);
            this.setState({ dialog: this.createRelationDialog(this.props.sourceTerm, this.props.targetTerm, messageArr, rule.msgType) })
            return;

         } else {//AGGREGATE MESSAGE
            if (rule.queryType == "select" && resultQ && resultQ.length > 0) {
               //use the bindings here
               const selectResult: Kefir.Property<{ [key: string]: Rdf.Node }[]> = <Kefir.Property<{ [key: string]: Rdf.Node }[]>>resultQ;
               const selectResult_first_item: Dictionary<Rdf.Node> = <Dictionary<Rdf.Node>>selectResult.map(x => x)[0];

               _.forEach(rule.bindings, prop => {

                  let tmp = (messageList.asImmutable())
                     .filterNot(msgItem => msgItem == "")
                     .map((msgItem, k) => {//msgItem is either a string of a react-element
                        const retval = (typeof msgItem == "string" && msgItem.length > 0 && msgItem.includes("__" + prop + "__") ? //split only the non-empty string items
                           msgItem.split("__" + prop + "__")
                              .reduce((aggr, item, j) => {
                                 const newlement = createElement("b", { key: "bProp" + counter + "-" + prop + k + j }, (selectResult_first_item[prop]).value);

                                 aggr = aggr.push(item).push((item.length > 0 && msgItem.includes(item + "__" + prop + "__") ? newlement : ""));
                                 return aggr;//the aggregator is a list of strings and react-elements
                              }, List<any>())
                           : msgItem);
                        return retval;//this is added to messageList via mapping: List or Symbol(react-element)
                     });

                  let messageList2: List<any> = List<any>();
                  tmp.forEach(item => { //flattens item into messageList)

                     if (typeof item == "string" || item.props) { //if item.props then this is a React element
                        messageList2 = messageList2.push(item);
                     }
                     else {//otherwise item is a List. e.g. (item.pop != undefined)
                        //console.log("expand list:");
                        (<List<any>>item).forEach((w, a) => { console.log(a); console.log(w); messageList2 = messageList2.push(w) });
                     }
                     messageList = messageList2;
                  })
               });

               messageArr = messageList.toArray();
               messageAggregatorArr.push(createElement("p", { key: "p" + counter }, messageArr));
               // messageAggregatorArr.push(messageArr);

               //} else if (rule.queryType == "select") { messageArr = []; } //clear current messages
            } else { messageArr = []; } //clear current messages


         }

         if (rules.length == 1) {//END-OF-RULE-PROCESS
            //const validation_existingChildren = (<Node>sourceTerm)["alreadyAlignedChildren"];
            const validation_existingChildren = (<Node>this.props.sourceTerm)["alreadyAlignedChildren"];//NEW
            messageArr = (validation_existingChildren ? [`Source term `, sourceElement("last"), ` contains already aligned descendants`] : undefined);
            messageAggregatorArr.push(messageArr);

            this.setState({ dialog: this.createRelationDialog(this.props.sourceTerm, this.props.targetTerm, messageAggregatorArr, "warning") })

         } else {//PASS, NEXT-RULE
            //this.recursiveRules(rules.slice(1), sourceTerm, targetTerm, alignmentNG, sourceNG, targetNG, messageAggregatorArr);
            //NEW
            this.recursiveRules(rules.slice(1), NGIri, messageAggregatorArr);
         }
      });

   }

   /*Returns an element conataining 
   * "messages and options" to choose an alignment relation, or 
   * an "alert message" in case of exception
   */
   createRelationDialog(source: Node, target: Node, messageArr: any[], messageType: "warning" | "danger"): React.ReactElement<any> {

      ///////// DANGER DIALOG /////////

      if (messageArr && messageType == "danger") {
         const alertInstance_error = (createFactory(Alert)({ key: "danger", className: "alert2", bsStyle: messageType }, messageArr));
         return OverlayDialogs.create_action_OverlayDialog("relation-selection", 'Alignment exception',
            alertInstance_error,
            () => { this.props.onAlertExceptionFunc(); this.resetDialog(); }
         );
      }


      ///////// CHOOSE RELATION DIALOG /////////

      const NavItemF = createFactory(NavItem);
      const NavF = createFactory(Nav);

      const sourceTermTitle = (source["label"] ? source["label"].value : source["iri"].value);
      const targetTermTitle = (target["label"] ? target["label"].value : target["iri"].value);

      ////Alignment info
      const alertInstance_info = (createFactory(Alert)({ key: "alertInfo", className: "alert2", bsStyle: "info" }, `Align term `, createElement("b", {}, sourceTermTitle), ` to `, createElement("b", {}, targetTermTitle), ` as:`));

      ////Create options
      const checkboxF = createFactory(ReactBootstrap.Checkbox);
      const options = [
         NavItemF({ key: "NavItemF1", eventKey: { relation: this.props.exactMatchAlignmentRelation, inversed: false }, title: `Term '${sourceTermTitle}' is exact-match to term '${targetTermTitle}'` }, this.props.exactMatchAlignmentRelation.title),
         NavItemF({ key: "NavItemF2", eventKey: { relation: this.props.closeMatchAlignmentRelation, inversed: false }, title: `Term '${sourceTermTitle}' is close-match to term '${targetTermTitle}'` }, this.props.closeMatchAlignmentRelation.title),
         NavItemF({ key: "NavItemF3", eventKey: { relation: this.props.relatedMatchAlignmentRelation, inversed: false }, title: `Term '${sourceTermTitle}' is related-match to term '${targetTermTitle}'` }, this.props.relatedMatchAlignmentRelation.title),
         NavItemF({ key: "NavItemF4", eventKey: { relation: this.props.broadMatchAlignmentRelation, inversed: false }, title: `Term '${sourceTermTitle}' is narrow term of '${targetTermTitle}'` }, this.props.broadMatchAlignmentRelation.title,
         ), checkboxF({
            style: { marginLeft: "50px" },
            //ref: "onlySubTerms_check",
            //checked: false,
            onClick: (e) => {
               e.stopPropagation();
               const target = <HTMLInputElement>e.target;
               this.props.onSelectOption_onlySubTerms_Func();
            }
         }, `Correlate only the subterms of '${sourceTermTitle}' as narrow terms`)

         //NavItemF({ key: "NavItemF3", eventKey: { relation: this.iBroader, inversed: true }, title: `Term '${sourceTermTitle}' is broader term of '${targetTermTitle}'` }, this.iBroader.title + " (inversed)"),
         //ADD-RELATION
      ];
      const navInstance = [
         alertInstance_info,
         NavF({
            key: "NavF",
            onSelect: (selectedKey) => {
               this.props.onSelectRelationFunc(selectedKey);
               OverlayDialogs.hideDialog("relation-selection");
               this.resetDialog()
            }
         },
            options,
         ),
         (messageArr ? createFactory(Alert)({ key: "warning", className: "alert2", bsStyle: messageType }, messageArr) : ""),
      ];

      return OverlayDialogs.create_action_OverlayDialog("relation-selection", 'Select alignment relation',
         navInstance,
         () => { this.props.onCloseDialogFunc(); this.resetDialog() }
      );
   }
}


export type component = RulesComponent;
export const component = RulesComponent;
export const factory = createFactory(component);
export default component;
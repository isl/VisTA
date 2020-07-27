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
	Component, DOM as D, ReactElement, createElement, createFactory, ReactNode,
} from 'react';
import { Rdf } from 'platform/api/rdf';
import { assign } from 'lodash';
import { Map, List } from 'immutable';

import {
	Node, MutableNode
} from 'platform/components/semantic/lazy-tree/NodeModel';

type Term = Node;

//export type SourceTermMapping = { iri: Rdf.Iri, label: Rdf.Literal, relation: Rdf.Iri, targetLabel: Rdf.Literal, inversedRelation?: boolean };//required information for aligned source-terms
//export type TargetTermMapping = { targetIri: Rdf.Iri, relation: Rdf.Iri, sourceLabel: Rdf.Literal, inversedRelation?: boolean };//required information for aligned source-terms
export type AlignedTermsMapping = { sourceIri: Rdf.Iri, sourceLabel: Rdf.Literal, targetIri: Rdf.Iri, targetLabel: Rdf.Literal, relation: Rdf.Iri, inversedRelation?: boolean };//required information for aligned source-terms

export interface AlignmentProps {


	/*
	* Information for source-terms: collection of all aligned-source-terms and their aligned-children as different ertries.
	* The collection is updated onLoad (Load Source Alignments), onDrop and onRemove.
	* For every source-term there is a boolean flag showing whether the term is aligned (either implicitly/explicitly) or not.
	* When a source-term is removed from the alignment, its flag turns to false.
	*/
	alignedSourceTermsTracker: Map<Rdf.Iri, boolean>;

	/*
	* Information for target-terms: collection of all aligned-target-terms. (It actually contains the current alignment state.)
	* The collection is updated onLoad, onDrop and onRemove. For every target-term there is SourceTermMapping to the aligned source-term.
	* When a term is removed from the alignment, the entry is removed from the collection.
	*/
	alignedTargetTermsMap: Map<Rdf.Iri, List<AlignedTermsMapping>>;//uses as key the target-term
	alignedSourceTermsMap: Map<Rdf.Iri, List<AlignedTermsMapping>>;//uses as key the source-term

}


export class Alignment {

	private props: AlignmentProps;

	constructor(props: AlignmentProps) {
		this.props = assign({}, props);
	}

	addAlignment(sourceTerm: Rdf.Iri, sourceLabel: Rdf.Literal, relation: Rdf.Iri, targetTerm: Rdf.Iri, targetLabel: Rdf.Literal, inversed?: boolean): boolean {
		let isAdded: boolean = false;
		if (!this.props.alignedTargetTermsMap) {
			this.props.alignedTargetTermsMap = Map<Rdf.Iri, List<AlignedTermsMapping>>();
		}
		if (!this.props.alignedSourceTermsMap) {
			this.props.alignedSourceTermsMap = Map<Rdf.Iri, List<AlignedTermsMapping>>();
		}
		//const array: Array<any> = [sourceTerm, sourceLabel, relation];
		const termMapping: AlignedTermsMapping = { sourceIri: sourceTerm, sourceLabel: sourceLabel, targetIri: targetTerm, targetLabel: targetLabel, relation: relation, inversedRelation: inversed }; //targetLabel: targetLabel.value

		//add to target-keyed map
		if (this.props.alignedTargetTermsMap.has(targetTerm)) {

			let list = this.props.alignedTargetTermsMap.get(targetTerm);
			let contains: boolean = false;
			list.forEach(item => {
				if (item.sourceIri.value == sourceTerm.value && item.relation.value == relation.value && item.inversedRelation == inversed) {
					contains = true;
				}
			});
			if (!contains) {
				isAdded = true;
				list = list.push(termMapping);
			}
			this.props.alignedTargetTermsMap = this.props.alignedTargetTermsMap.set(targetTerm, list);
		} else {
			isAdded = true;
			let list = List<AlignedTermsMapping>();
			list = list.push(termMapping);
			this.props.alignedTargetTermsMap = this.props.alignedTargetTermsMap.set(targetTerm, list);
		}

		//add to source-keyed map
		if (this.props.alignedSourceTermsMap.has(sourceTerm)) {

			let list = this.props.alignedSourceTermsMap.get(sourceTerm);
			let contains: boolean = false;
			list.forEach(item => {
				if (item.targetIri.value == targetTerm.value && item.relation.value == relation.value && item.inversedRelation == inversed) {
					contains = true;
				}
			});
			if (!contains) {
				isAdded = true;
				list = list.push(termMapping);
			}
			this.props.alignedSourceTermsMap = this.props.alignedSourceTermsMap.set(sourceTerm, list);
		} else {
			isAdded = true;
			let list = List<AlignedTermsMapping>();
			list = list.push(termMapping);
			this.props.alignedSourceTermsMap = this.props.alignedSourceTermsMap.set(sourceTerm, list);
		}
		return isAdded;
	}

	releaseAlignment(sourceTerm: Rdf.Iri, relation: Rdf.Iri, targetTerm: Rdf.Iri, inversed: boolean): void {
		//let isAligned: boolean = true;
		//remove from target-keyed map
		let targetValues: List<AlignedTermsMapping> = this.props.alignedTargetTermsMap ? this.props.alignedTargetTermsMap.get(targetTerm) : undefined;
		if (targetValues) {
			//let values: List<AlignedTermsMapping> = this.props.alignedTargetTermsMap.get(targetTerm);
			targetValues.forEach((item, i) => { //item: SourceTermMapping
				if (sourceTerm.value == item.sourceIri.value && relation.value == item.relation.value) {
					targetValues = targetValues.delete(i);
				}
			});
			if (targetValues.count() > 0) {
				this.props.alignedTargetTermsMap = this.props.alignedTargetTermsMap.set(targetTerm, targetValues);
			} else {
				this.props.alignedTargetTermsMap = this.props.alignedTargetTermsMap.remove(targetTerm);
			}
		}

		//remove from source-keyed map
		let sourcevalues: List<AlignedTermsMapping> = this.props.alignedSourceTermsMap ? this.props.alignedSourceTermsMap.get(sourceTerm) : undefined;
		if (sourcevalues) {
			//let values: List<AlignedTermsMapping> = this.props.alignedSourceTermsMap.get(sourceTerm);
			sourcevalues.forEach((item, i) => { //item: SourceTermMapping
				if (targetTerm.value == item.targetIri.value && relation.value == item.relation.value) {
					sourcevalues = sourcevalues.delete(i);
				}
			});
			if (sourcevalues.count() > 0) {
				this.props.alignedSourceTermsMap = this.props.alignedSourceTermsMap.set(sourceTerm, sourcevalues);
			} else {
				this.props.alignedSourceTermsMap = this.props.alignedSourceTermsMap.remove(sourceTerm);
			}
		}
	}

	trackSourceTermAlignment(term: Rdf.Iri, isAligned) {
		if (!this.props.alignedSourceTermsTracker) {
			this.props.alignedSourceTermsTracker = Map<Rdf.Iri, boolean>();
		}
		this.props.alignedSourceTermsTracker = this.props.alignedSourceTermsTracker.set(term, isAligned);
	}

	isSourceTermAligned(term: Rdf.Iri): boolean { //either implicitly or explicitly
		if (!this.props.alignedSourceTermsTracker) { return false; }
		return this.props.alignedSourceTermsTracker.get(term);
	}

	isSourceTermExplicitlyAligned(sourceTerm: Rdf.Iri): boolean {//only explicit alignments
		if (this.props.alignedTargetTermsMap) {
			const values: Iterator<List<AlignedTermsMapping>> = this.props.alignedTargetTermsMap.values();
			let value = values.next();
			while (!value.done) {
				if (value.value && value.value.find(i => { return (sourceTerm.value == i.sourceIri.value) })) {
					return true;
				}
				value = values.next();
			}
		}
		return false;
	}

	isSourceTermExplicitlyAlignedInContext(sourceTerm: Rdf.Iri, targetTerm: Rdf.Iri, relation?: Rdf.Iri): boolean {//only explicit alignments
		if (this.props.alignedTargetTermsMap && this.props.alignedTargetTermsMap.has(targetTerm)) {
			//return Boolean(this.props.alignedTargetTermsMap.get(targetTerm).find(list => list.iri.value == sourceTerm.value));
			return Boolean(this.props.alignedTargetTermsMap.get(targetTerm)
				.find(list => list.sourceIri.value == sourceTerm.value && (relation ? list.relation.value == relation.value : true)));
		}
		return false;
	}

	// It returns a map from an aligned target-term to itsself mapping, used to render the aligned target terms
	////TO BE REVISED THE MECHANISM OF displaySourceAlignments @VIEW
	_TBDELETED_getTargetAlignmentMapping(): Map<Rdf.Iri, List<AlignedTermsMapping>> {
		if (!this.props.alignedTargetTermsMap) {
			return undefined;
		}
		let mappedAlignments = Map<Rdf.Iri, List<AlignedTermsMapping>>();	//INIT
		const targetKeys = this.props.alignedTargetTermsMap.keys(); //Keys(iris) of aligned target-terms

		let tKey = targetKeys.next();
		while (!tKey.done) {
			let list = this.props.alignedTargetTermsMap.get(tKey.value);
			list.forEach(tItem => {
				const targetTermMapping: AlignedTermsMapping = { sourceIri: tItem.sourceIri, sourceLabel: tItem.sourceLabel, targetIri: tKey.value, relation: tItem.relation, targetLabel: tItem.targetLabel };

				if (mappedAlignments.has(tItem.targetIri)) {

					let targetMappingList: List<AlignedTermsMapping> = mappedAlignments.get(tItem.targetIri);
					let contains: boolean = false;
					targetMappingList.forEach(i => { // i is a AlignedTermsMapping
						if (i.targetIri.value == tKey.value.value && tItem.relation.value === i.relation.value) {//Is this safe? there are maybe more source terms with the same relation to the target!!!!
							contains = true;
						}
					});
					if (!contains) {

						targetMappingList = targetMappingList.push(targetTermMapping);
					}
					mappedAlignments = mappedAlignments.set(tItem.targetIri, targetMappingList);

				} else {
					let targetMappingList = List<AlignedTermsMapping>();
					targetMappingList = targetMappingList.push(targetTermMapping);
					mappedAlignments = mappedAlignments.set(tItem.targetIri, targetMappingList);
				}
			})

			tKey = targetKeys.next();
		}
		return mappedAlignments;
	}

	getAlignedTargetTermsMap() {
		return this.props.alignedTargetTermsMap;
	}

	getAlignedSourceTermsMap() {
		return this.props.alignedSourceTermsMap;
	}

	getTargetTermRelation(targetTerm: Rdf.Iri): List<AlignedTermsMapping> {
		if (this.props.alignedTargetTermsMap) {
			if (this.props.alignedTargetTermsMap.has(targetTerm)) {
				const list = this.props.alignedTargetTermsMap.get(targetTerm);
				return list;
			} else {
				return undefined;
			}
		}
	}

	getTargetTermsByAlignedSourceTermByRelation(sourceTerm: Rdf.Iri, relation?: Rdf.Iri): Set<Rdf.Iri> {
		let targetTerms: Set<Rdf.Iri> = new Set<Rdf.Iri>();
		if (this.props.alignedTargetTermsMap) {
			this.props.alignedTargetTermsMap.forEach((mappingsList: List<AlignedTermsMapping>, key: Rdf.Iri) => {
				if (mappingsList.find(i => (sourceTerm.value == i.sourceIri.value && (relation ? relation.value == i.relation.value : true)))) targetTerms.add(key)
			});
		}
		return targetTerms;
	}



}//class


export type component = Alignment;
export const component = Alignment;
export default Alignment;



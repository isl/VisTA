/*
 * Copyright (C) 2015-2017, metaphacts GmbH
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

import { createElement} from 'react';
import { expect } from 'chai';
import { mount } from 'enzyme';
import * as sinon from 'sinon';

import { Rdf } from 'platform/api/rdf';
import { __unsafe__setCurrentResource } from 'platform/api/navigation';

import {
  ResourceEditorForm, PlainTextInput, DataState, FieldValue, normalizeFieldDefinition,
} from 'platform/components/forms';

__unsafe__setCurrentResource(Rdf.iri('http://test'));

const xsdDatatype = 'http://www.w3.org/2001/XMLSchema#string';

const fieldProps = {
  definition: normalizeFieldDefinition({
    id: '',       // these will be overwritten bz the field definition in the test
    label: '',    // these will be overwritten bz the field definition in the test
    xsdDatatype: Rdf.iri(xsdDatatype),
    minOccurs: 0, // these will be overwritten bz the field definition in the test
    maxOccurs: 0, // these will be overwritten bz the field definition in the test
    selectPattern: '',
  }),
  for: 'testId',
  value: FieldValue.empty,
  dataState: DataState.Ready,
};

describe('ResourceEditorForm with field inputs according to cardinality initalized', () => {
  const BASIC_PROPS = {
    fields: [
      {
        id: 'testId',
        xsdDatatype: xsdDatatype,
        minOccurs: 2,
        maxOccurs: 3,
      },
    ],
    children: [
      createElement(PlainTextInput, fieldProps),
    ],
  };

  const server = sinon.fakeServer.create();
  server.respondWith('GET', '/rest/data/rdf/namespace/getRegisteredPrefixes',
    [200, { 'Content-Type': 'application/json' }, '{ }']);

    const form = mount(createElement(ResourceEditorForm, BASIC_PROPS));

    it('render field component with two inputs pre-initalized', () => {
      expect(form.find('PlainTextInput').length).to.be.eql(2);
    });

    describe('remove and add values according to minOccurs=2 and maxOccurs=3 definitions', () => {
      const REMOVE_BUTTON_SELECTOR = '.cardinality-support__remove-value';
      const ADD_BUTTON_SELECTOR = '.cardinality-support__add-value';
      const addButton = form.find(ADD_BUTTON_SELECTOR);

      it('does have an add value button', () => {
        expect(addButton).to.have.length(1);
      });

      it('can add field value until number of values equals maxOccurs', () => {
        addButton.simulate('click');
        expect(form.find('PlainTextInput').length).to.be.eql(3);
      });

      it('can\'t add field value when number of values equals maxOccurs', () => {
        expect(form.is(ADD_BUTTON_SELECTOR)).to.be.false;
        addButton.simulate('click');
        expect(form.find('PlainTextInput').length).to.be.eql(3);
      });

      it('can remove field value when number of values is not lower minOccurs', () => {
        const removeButton = form.find(REMOVE_BUTTON_SELECTOR).first();
        removeButton.simulate('click');
        expect(form.find('PlainTextInput').length).to.be.eql(2);
      });

      it('can\'t remove field when number of values is equals to minOccurs', () => {
        const removeButton = form.find(REMOVE_BUTTON_SELECTOR);
        expect(removeButton.length).to.be.eql(0);
      });
    });
});

describe('ResourceEditorForm with minOccurs 0, adding values and removing all', () => {
  const server = sinon.fakeServer.create();
  server.respondWith('GET', '/rest/data/rdf/namespace/getRegisteredPrefixes',
    [200, { 'Content-Type': 'application/json' }, '{ }']);

    const BASIC_PROPS = {
      fields: [
        {
          id: 'testId',
          xsdDatatype: xsdDatatype,
          minOccurs: 0,
          maxOccurs: 2,
        },
      ],
      children: [
        createElement(PlainTextInput, fieldProps),
      ],
    };

    const form = mount(createElement(ResourceEditorForm, BASIC_PROPS));

    it('render field component with 1 inputs pre-initalized', () => {
      expect(form.find('PlainTextInput').length).to.be.eql(1);
    });

    describe('remove and add values according to minOccurs=0 and maxOccurs=2 definitions', () => {
      const REMOVE_BUTTON_SELECTOR = '.cardinality-support__remove-value';
      const ADD_BUTTON_SELECTOR = '.cardinality-support__add-value';
      const addButton = form.find(ADD_BUTTON_SELECTOR);

      it('does have an add value button and one input initalized', () => {
        expect(addButton).to.have.length(1);
        expect(form.find('PlainTextInput').length).to.be.eql(1);
      });

      it('can add field value until number of values equals maxOccurs', () => {
        addButton.simulate('click');
        expect(form.find('PlainTextInput').length).to.be.eql(2);
      });

      it('can\'t add field value when number of values equals maxOccurs', () => {
        expect(form.is(ADD_BUTTON_SELECTOR)).to.be.false;
        addButton.simulate('click');
        expect(form.find('PlainTextInput').length).to.be.eql(2);
      });

      it('can remove field value when number of values is not lower minOccurs', () => {
        const removeButton = form.find(REMOVE_BUTTON_SELECTOR).first();
        removeButton.simulate('click');
        expect(form.find('PlainTextInput').length).to.be.eql(1);
      });

      it('can remove last value as well', () => {
        const removeButton = form.find(REMOVE_BUTTON_SELECTOR).first();
        removeButton.simulate('click');
        expect(form.find('PlainTextInput').everyWhere(input => {
          const node: HTMLElement = input.getDOMNode();
          // element should be invisible
          return node.offsetParent === null;
        })).to.be.true;
      });

      it('can\'t remove field when number of values is equals to minOccurs (0)', () => {
        expect(form.is(REMOVE_BUTTON_SELECTOR)).to.be.false;
      });
    });
});

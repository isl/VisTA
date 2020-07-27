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

import { createElement, DOM as D } from 'react';
import { expect } from 'chai';
import { mount, shallow } from 'enzyme';
import { clone } from 'lodash';
import * as Immutable from 'immutable';
import * as sinon from 'sinon';

import { __unsafe__setCurrentResource } from 'platform/api/navigation';
import { Rdf } from 'platform/api/rdf';
import {
  ResourceEditorForm,
  ResourceEditorFormProps,
  ResourceEditorFormState,
  DataState, FieldValue, PlainTextInput,
} from 'platform/components/forms';

__unsafe__setCurrentResource(Rdf.iri('test'));

import { FIELD_DEFINITION } from './fixturies/FieldDefinition';
import { PROPS as FIELD_PROPS } from './fixturies/FieldProps';

const BASIC_PROPS = {
  fields: [FIELD_DEFINITION],
  children: [
    createElement(PlainTextInput, FIELD_PROPS),
    D.button({name: 'reset'}),
    D.button({name: 'submit'}),
  ],
};

const xsdDatatype = 'http://www.w3.org/2001/XMLSchema#string';

describe('ResourceEditorForm Component', () => {
  const server = sinon.fakeServer.create();
  server.respondWith('GET', '/rest/data/rdf/namespace/getRegisteredPrefixes',
    [200, { 'Content-Type': 'application/json' }, '{ }']);

  describe('render', () => {
    const form = shallow(createElement(ResourceEditorForm, clone(BASIC_PROPS)));

    it('render SemanticForm components', () => {
      expect(form.find('SemanticForm')).to.have.length(1);
    });

    it('field component', () => {
      expect(form.find('PlainTextInput')).to.have.length(1);
    });

    describe('buttons', () => {
      it('have submit button', () => {
        expect(form.find('[name="submit"]')).to.have.length(1);
      });

      it('have reset button', () => {
        expect(form.find('[name="reset"]')).to.have.length(1);
      });
    });
  });

  it('have correct state after input change', () => {
    let properties = clone(BASIC_PROPS);
    properties.fields[0]['xsdDatatype'] = xsdDatatype;
    const form = mount<ResourceEditorFormProps, ResourceEditorFormState>(
      createElement(ResourceEditorForm, properties)
    );
    const value = 'testValue';
    form.find('input').simulate('change', {target: {value: value}});

    const stateValue = FieldValue.fromLabeled({value: Rdf.literal('testValue')});

    const formModel: FieldValue = form.state().model;
    const formState = (formModel && FieldValue.isComposite(formModel))
      ? formModel.fields.toArray() : [];
    const fieldValue = formState[0].values.first();
    const formRdfValue = FieldValue.asRdfNode(fieldValue);

    expect(formRdfValue.value).to.equal(
      stateValue.value.value,
      'form model should have correct value'
    );
    expect(formRdfValue.isLiteral()).to.be.true;
    expect((formRdfValue as Rdf.Literal).dataType.value).to.eql(
      (stateValue.value as Rdf.Literal).dataType.value,
      'form model should have correct dataType'
    );
  });

  describe('minOccur & maxOccur:', () => {
    const form = mount<ResourceEditorFormProps, ResourceEditorFormState>(
      createElement(ResourceEditorForm, BASIC_PROPS)
    );

    describe('maxOccur', () => {
      const addButton = form.find('.cardinality-support__add-value');

      it('have add button', () => {
        expect(addButton).to.have.length(1);
      });

      it('can add field when does not exceed maxOccur', () => {
        addButton.simulate('click');
        expect(form.find('PlainTextInput').length).to.be.eql(2);
      });

      it('can\'t add field when its exceed maxOccur', () => {
        addButton.simulate('click');
        expect(form.find('PlainTextInput').length).to.be.eql(2);
      });
    });

    describe('minOccur', () => {
      const REMOVE_BUTTON_SELECTOR = '.cardinality-support__remove-value';

      it('can remove field when does not exceed minOccur', () => {
        const removeButton = form.find(REMOVE_BUTTON_SELECTOR).first();
        removeButton.simulate('click');
        expect(form.find('PlainTextInput').length).to.be.eql(1);
      });

      it('can\'t remove field when its exceed minOccur', () => {
        const removeButton = form.find(REMOVE_BUTTON_SELECTOR);
        expect(removeButton.length).to.be.eql(0);
      });
    });
  });
});

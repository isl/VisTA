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

import {
  DOM as D,
  createFactory,
  createElement,
  MouseEvent,
  FormEvent,
  ChangeEvent,
} from 'react';

import * as bem from 'bem-cn';
import {intersection} from 'lodash';
import * as ReactBootstrap from 'react-bootstrap';
import * as ReactSelectComponent from 'react-select';
import TextareaAutosize from 'react-textarea-autosize';
import {Just, Nothing} from 'data.maybe';
import * as Kefir from 'kefir';
import * as N3 from 'n3';
import * as classnames from 'classnames';

import { Component } from 'platform/api/components';
import { Rdf, vocabularies } from 'platform/api/rdf';
import { SparqlUtil, QueryVisitor, cloneQuery, SparqlTypeGuards } from 'platform/api/sparql';
import { navigateToResource } from 'platform/api/navigation';
import { LdpService } from 'platform/api/services/ldp';

import { SparqlEditor } from 'platform/components/sparql-editor';
import {
  SemanticTreeInput, SemanticTreeInputProps, TreeSelection,
} from 'platform/components/semantic/lazy-tree';
import { Spinner } from 'platform/components/ui/spinner';

import { createDefaultCategoryQueries } from './CategoryDefaults';
import row from './FieldEditorRow';
import {
  State, Value, getFieldDefitionState, createFieldDefinitionGraph, unwrapState,
} from './FieldEditorState';

import './field-editor.scss';

const btn = createFactory(ReactBootstrap.Button);
const bsrow = createFactory(ReactBootstrap.Row);
const bscol = createFactory(ReactBootstrap.Col);
const input = createFactory(ReactBootstrap.FormControl);
const textarea = createFactory(TextareaAutosize);
const select = createFactory(ReactSelectComponent);

const FIELD_DEF_INSTANCE_BASE = 'http://www.metaphacts.com/fieldDefinition/';
const CLASS_NAME = 'field-editor';
const block = bem(CLASS_NAME);

interface QueryInfo {
  type: string;
  hasValue: boolean;
  hasSubject: boolean;
  projectionVariables: string[];
}

interface Props {
  /**
   * IRI of the field definition to be edited.
   */
  fieldIri?: string;
  /**
   * Optional string to make the base IRI being used
   * for creating new field definitions configurable
   */
  fieldInstanceBaseIri?: string;
  /**
   * Full IRI enclosed in <> or prefixed IRI
   */
  categoryScheme?: string;
}

/* Default queries to be set on the SPARQL input elements as placeholders */
const DEFAULT_INSERT = 'INSERT { $subject ?predicate $value} WHERE {}';
const DEFAULT_SELECT = `SELECT ?value ?label WHERE {
  $subject ?predicate ?value; rdfs:label ?label
}`;
const DEFAULT_DELETE = 'DELETE { $subject ?predicate $value} WHERE {}';
const DEFAULT_ASK = 'ASK {}';
const DEFAULT_VALUE_SET = `SELECT ?value ?label WHERE {
  ?value a ?anyType ;
    rdfs:label ?label .
}`;
const DEFAULT_AUTOSUGGESTION = `SELECT ?value ?label WHERE {
  ?value a ?anyType ;
    rdfs:label ?label .
  FILTER REGEX(STR(?label), "?token")
} LIMIT 10`;

class FieldEditorComponent extends Component<Props, State> {
  static readonly defaultProps: Partial<Props> = {
    categoryScheme: '<http://www.metaphacts.com/ontologies/platform/FieldCategories>',
  };

  /**
   * Declare and init empty pools. One pool for each input element.
   */
  private id = Kefir.pool<string>();
  private label = Kefir.pool<string>();
  private description = Kefir.pool<string>();
  private categories = Kefir.pool<ReadonlyArray<Rdf.Iri>>();
  private insert = Kefir.pool<string>();
  private domain = Kefir.pool<string>();
  private xsd = Kefir.pool<string>();
  private range = Kefir.pool<string>();
  private min = Kefir.pool<string>();
  private max = Kefir.pool<string>();
  private defaultValues = Kefir.pool<string[]>();
  private ask = Kefir.pool<string>();
  private delete = Kefir.pool<string>();
  private select = Kefir.pool<string>();
  private valueset = Kefir.pool<string>();
  private autosuggestion = Kefir.pool<string>();
  private testSubject = Kefir.pool<string>();

  constructor(props: Props, context: any) {
    super(props, context);
    const [categoryScheme] = SparqlUtil.resolveIris([this.props.categoryScheme]);
    const categoryQueries = createDefaultCategoryQueries(categoryScheme);

    this.state = {
      id: Nothing<Value>(),
      label: Nothing<Value>(),
      description: Nothing<Value>(),
      categories: [],
      domain: Nothing<Value>(),
      xsdDatatype: Nothing<Value>(),
      range: Nothing<Value>(),
      min: Nothing<Value>(),
      max: Nothing<Value>(),
      defaults: [] as Value[],
      testSubject: Nothing<Value>(),
      insertPattern: Nothing<Value>(),
      selectPattern: Nothing<Value>(),
      deletePattern: Nothing<Value>(),
      askPattern: Nothing<Value>(),
      valueSetPattern: Nothing<Value>(),
      autosuggestionPattern: Nothing<Value>(),

      isLoading: this.isEditMode(),
      finalObject: Nothing<Rdf.Graph>(),
      categoryQueries,
    };
    this.initPools();
  }

  public componentDidMount() {
    // only if in edit mode, we try to fetch an existing
    // field definition (as identified by the provided fieldIri
    // from backend and de-serialize it back to the component state.
    if (this.isEditMode()) {
      const fieldIri = Rdf.iri(this.props.fieldIri);
      getFieldDefitionState(fieldIri).onValue(
        // THIS IS IMPORTANT
        // Once de-serialzed we will set the state (including all de-serialized values),
        // {loading: false} and init the pools.
        this.loadState
      );
    }
  }

  private loadState = (state: State) => {
    this.setState(state);
    const fields = unwrapState(state);
    const tryPlug = <T>(pool: Kefir.Pool<T>, value: T | undefined) => {
      const nonEmpty = !Array.isArray(value) || value.length > 0;
      if (value && nonEmpty) {
        pool.plug(Kefir.constant(value));
      }
    };

    tryPlug(this.id, fields.id);
    tryPlug(this.label, fields.label);
    tryPlug(this.description, fields.description);
    tryPlug(this.categories, fields.categories);
    tryPlug(this.domain, fields.domain);
    tryPlug(this.xsd, fields.xsdDatatype);
    tryPlug(this.range, fields.range);
    tryPlug(this.min, fields.min);
    tryPlug(this.max, fields.max);
    tryPlug(this.defaultValues, fields.defaultValues);
    tryPlug(this.testSubject, fields.testSubject);
    tryPlug(this.insert, fields.insertPattern);
    tryPlug(this.select, fields.selectPattern);
    tryPlug(this.delete, fields.deletePattern);
    tryPlug(this.ask, fields.askPattern);
    tryPlug(this.valueset, fields.valueSetPattern);
    tryPlug(this.autosuggestion, fields.autosuggestionPattern);
  }

  public render() {
    return D.div({className: block('').toString()},
      this.state.isLoading ? createElement(Spinner) : this.renderEditor()
    );
  }

  /**
   * Renders the editor in a row / column layout using different input elements.
   *
   * Each input emits values on change into respective pools i.e. input elements
   * do not provide any validation on their own.
   */
  private isMaxSet() {
    const {max} = this.state;
    return max.isJust && parseInt(max.get().value) >= 1;
  }

  private defaultsUpToMax() {
    const {defaults, max} = this.state;
    if (!this.isMaxSet()) {
      return defaults;
    }
    const maxInt = parseInt(max.get().value);
    return defaults.slice(0, maxInt);
  }

  private renderEditor = () => {
    return D.div({},
      row({
          collapsible: false,
          label: 'Label*',
          error: this.state.label.isJust ? this.state.label.get().error : undefined,
          element: input({
            className: block('label-input').toString(),
            type: 'text',
            placeholder: 'Label',
            onChange: e => this.label.plug(this.getFormValue(e)),
            value: this.state.label.isJust ? this.state.label.get().value : undefined,
          }),
        }
      ),
      row({
          collapsible: false,
          label: 'Identifier*',
          error: this.state.id.isJust ? this.state.id.get().error : undefined,
          element: [
            input({
              className: block('iri-input').toString(),
              type: 'text',
              placeholder: 'Any IRI to be used as unique identifier for the field definition.',
              onChange: e => this.id.plug(this.getFormValue(e)),
              value: this.state.id.isJust ? this.state.id.get().value : undefined,
              style: {float: 'left', width: '95%'},
              disabled: this.isEditMode(),
            }),
            this.isEditMode() ? null : D.i({
              className: block('generate-iri').toString(),
              title: 'Generate IRI',
              onClick: (e: MouseEvent<HTMLElement>) => this.generateIRI(),
            }),
          ],
        }
      ),
      row({
          label: 'Description',
          collapsible: !this.state.description.isJust,
          element: textarea({
            className: classnames('form-control', block('description-input').toString()),
            rows: 4,
            placeholder: 'Description',
            onChange:  e => this.description.plug(this.getFormValue(e)),
            value: this.state.description.isJust ? this.state.description.get().value : undefined,
          }),
        }
      ),
      row({
        label: 'Categories',
        collapsible: false,
        element: createElement(SemanticTreeInput, {
          ...this.state.categoryQueries,
          initialSelection: this.state.categories,
          multipleSelection: true,
          onSelectionChanged: selection => {
            const categories = TreeSelection.leafs(selection).map(node => node.iri).toArray();
            this.categories.plug(Kefir.constant(categories));
          }
        } as SemanticTreeInputProps),
      }),
      row({
        label: 'Domain',
        collapsible: !this.state.domain.isJust,
        error: this.state.domain.map(v => v.error).getOrElse(undefined),
        element: input({
          className: block('domain-input').toString(),
          type: 'text',
          placeholder: 'Any IRI to be used as domain for the field definition.',
          onChange: e => this.domain.plug(this.getFormValue(e)),
          value: this.state.domain.map(v => v.value).getOrElse(''),
        }),
      }),
      row({
          label: 'XSD Datatype',
          collapsible: !this.state.xsdDatatype.isJust,
          error: this.state.xsdDatatype.map(v => v.error).getOrElse(undefined),
          element: select({
            value: this.state.xsdDatatype.map(v => v.value).getOrElse(undefined),
            className: block('xsd-input').toString(),
            multi: false,
            clearable: false,
            placeholder: 'Please select any XSD datatype',
            options: vocabularies.xsd.LIST_TYPES,
            onChange: (e: Value) => this.xsd.plug(Kefir.constant<string>(e.value)),
            labelKey: 'label',
            valueKey: 'value',
          }),
        }
      ),
      row({
        label: 'Range',
        collapsible: !this.state.domain.isJust,
        error: this.state.domain.map(v => v.error).getOrElse(undefined),
        element: input({
          className: block('range-input').toString(),
          type: 'text',
          placeholder: 'Any IRI to be used as range for the field definition.',
          onChange: e => this.range.plug(this.getFormValue(e)),
          value: this.state.range.map(v => v.value).getOrElse(''),
        }),
      }),
      row({
          label: 'Min. Cardinality',
          collapsible: this.state.min.isJust ? false : true,
          error: this.state.min.isJust ? this.state.min.get().error : undefined,
          element: input({
            className: block('min-input').toString(),
            type: 'number',
            min: 0,
            step: 1,
            placeholder: 'Any positive number from 0 to n. \"0\" for not required.',
            onChange:  e => this.min.plug(this.getFormValue(e)),
            value: this.state.min.isJust ? this.state.min.get().value : undefined,
          }),
        }
      ),
      row({
          label: 'Max. Cardinality',
          collapsible: this.state.max.isJust ? false : true,
          error: this.state.max.isJust ? this.state.max.get().error : undefined,
          element: input({
            className: block('max-input').toString(),
            type: 'text',
            placeholder: 'Any positive number from 1 to n. \"Unbound\" for unlimited.',
            onChange: e => this.max.plug(this.getFormValue(e)),
            value: this.state.max.isJust ? this.state.max.get().value : undefined,
          }),
        }
      ),
      row({
        label: 'Default values',
        collapsible: false,
        element: [
          ...this.defaultsUpToMax().map(({value}, index) => D.div(
            {className: block('default-input-holder').toString()},
            input({
              className: block('default-input').toString(),
              type: 'text',
              onChange: e => {
                const input = (e.target as any).value;
                let defaults = this.defaultsUpToMax().map(v => v.value);
                defaults[index] = input;
                this.defaultValues.plug(Kefir.constant(defaults));
              },
              value: this.state.defaults[index].value,
            }),
            btn({
              className: block('delete-default').toString(),
              onClick: () => {
                let defaults = this.defaultsUpToMax().map(v => v.value);
                defaults.splice(index, 1);
                this.defaultValues.plug(Kefir.constant(defaults));
              }
            }, D.span({className: 'fa fa-times'}))
          )),
          !(this.isMaxSet() && this.state.defaults.length >= parseInt(this.state.max.get().value)) ? D.a({
            onClick: () => {
              let defaults = this.defaultsUpToMax().map(v => v.value);
              defaults.push('');
              this.defaultValues.plug(Kefir.constant(defaults));
            }
          }, '+ Add default value') : null,
        ],
      }),
      row({
          label: 'Insert Pattern*',
          collapsible: false,
          onExpand: () => this.insert.plug(Kefir.constant(DEFAULT_INSERT)),
          error: this.state.insertPattern.map(v => v.error).getOrElse(undefined),
          element: createElement(SparqlEditor, {
            onChange: e => this.insert.plug(Kefir.constant(e.value)),
            syntaxErrorCheck: false,
            query: this.state.insertPattern.map(v => v.value).getOrElse(''),
          }),
        }
      ),
      row({
          label: 'Select Pattern',
          collapsible: !this.state.selectPattern.isJust,
          onExpand: () => this.select.plug(Kefir.constant(DEFAULT_SELECT)),
          error: this.state.selectPattern.map(v => v.error).getOrElse(undefined),
          element: createElement(SparqlEditor, {
            onChange: e => this.select.plug(Kefir.constant(e.value)),
            syntaxErrorCheck: false,
            query: this.state.selectPattern.map(v => v.value).getOrElse(''),
          }),
        }
      ),
      row({
          label: 'Delete Pattern',
          collapsible: !this.state.deletePattern.isJust,
          onExpand: () => this.delete.plug(Kefir.constant(DEFAULT_DELETE)),
          error: this.state.deletePattern.map(v => v.error).getOrElse(undefined),
          element: createElement(SparqlEditor, {
            onChange: e => this.delete.plug(Kefir.constant(e.value)),
            syntaxErrorCheck: false,
            query: this.state.deletePattern.map(v => v.value).getOrElse(''),
          }),
        }
      ),
      row({
          label: 'ASK Validation Pattern',
          collapsible: !this.state.askPattern.isJust,
          onExpand: () => this.ask.plug(Kefir.constant(DEFAULT_ASK)),
          error: this.state.askPattern.map(v => v.error).getOrElse(undefined),
          element: createElement(SparqlEditor, {
            onChange: e => this.ask.plug(Kefir.constant(e.value)),
            syntaxErrorCheck: false,
            query: this.state.askPattern.map(v => v.value).getOrElse(''),
          }),
        }
      ),
      row({
          label: 'Value Set Pattern',
          collapsible: !this.state.valueSetPattern.isJust,
          onExpand: () => this.valueset.plug(Kefir.constant(DEFAULT_VALUE_SET)),
          error: this.state.valueSetPattern.map(v => v.error).getOrElse(undefined),
          element: createElement(SparqlEditor, {
            onChange: e => this.valueset.plug(Kefir.constant(e.value)),
            syntaxErrorCheck: false,
            query: this.state.valueSetPattern.map(v => v.value).getOrElse(''),
          }),
        }
      ),
      row({
          label: 'Autosuggestion Pattern',
          collapsible: !this.state.autosuggestionPattern.isJust,
          onExpand: () => this.autosuggestion.plug(Kefir.constant(DEFAULT_AUTOSUGGESTION)),
          error: this.state.autosuggestionPattern.map(v => v.error).getOrElse(undefined),
          element: createElement(SparqlEditor, {
            onChange: e => this.autosuggestion.plug(Kefir.constant(e.value)),
            syntaxErrorCheck: false,
            query: this.state.autosuggestionPattern.map(v => v.value).getOrElse(''),
          }),
        }
      ),
      row({
          label: 'Test Subject',
          collapsible: this.state.testSubject.isJust ? false : true,
          error: this.state.testSubject.isJust ? this.state.testSubject.get().error : undefined,
          element: input({
            className: block('label-input').toString(),
            type: 'text',
            placeholder: `IRI of any entity to be used for testing the patterns of the field.`,
            onChange: e => this.testSubject.plug(this.getFormValue(e)),
            value: this.state.testSubject.isJust ? this.state.testSubject.get().value : undefined,
          }),
        }
      ),
      bsrow({},
        bscol({md: 3}),
        bscol({md: 9},
          btn({
              type: 'submit',
              disabled: this.state.finalObject.isNothing,
              bsSize: 'small',
              onClick: this.onSaveOrUpdate,
              style: { marginLeft: '-15px' },
            },
            this.isEditMode() ? 'Update Field' : 'Create Field'
          )
        )
      )
    );
  }

  private isEditMode = (): boolean => {
    return Boolean(this.props.fieldIri);
  }

  /**
   * Central place to init all value streams (pools) with undefined (not yet set) or
   * existing values (if re-initalized form existing field definiton).
   * Hooks-in individual validation methods for each value stream, which will either
   * flatMap to an valid value observable or to an error.
   */
  private initPools = () => {
    const iriMapped = this.id.flatMap(this.validateIri);
    iriMapped.onValue(
      v => this.setState({ id: Just(v) })
    ).onError(
      v => this.setState({ id: Just(v), finalObject: Nothing<Rdf.Graph>() })
    );

    const labelMapped = this.label.flatMap(this.validateLabel);
    labelMapped.onValue(v => this.setState({ label: Just(v) })).debounce(100)
    .map(v =>
      // on change of label we try to auto-generate some IRI if no identifier has been provided yet
      this.generateIriFromLabel(v.value)
    ).onError(
      v => this.setState({ label: Just(v), finalObject: Nothing<Rdf.Graph>() })
    );

    const descriptionMapped = this.description.flatMap(this.validateDescription);
    descriptionMapped.onValue(
      v => this.setState({ description: Just(v) })
    ).onError(
      v => this.setState({ description: Just(v), finalObject: Nothing<Rdf.Graph>() })
    );

    this.categories.observe({
      value: categories => this.setState({categories}),
    });

    const domainMapped = this.domain.map<Value>(v => ({value: v}));
    domainMapped.observe({
      value: v => this.setState({domain: Just(v)}),
      error: v => this.setState({domain: Just(v), finalObject: Nothing<Rdf.Graph>()}),
    });

    const xsdMapped = this.xsd.map<Value>(v => ({value: v}));
    xsdMapped.observe({
      value: v => this.setState({xsdDatatype: Just(v)}),
      error: (v: Value) => this.setState({
        xsdDatatype: Just(v),
        finalObject: Nothing<Rdf.Graph>(),
      })
    });

    const rangeMapped = this.range.map<Value>(v => ({value: v}));
    rangeMapped.observe({
      value: v => this.setState({range: Just(v)}),
      error: v => this.setState({range: Just(v), finalObject: Nothing<Rdf.Graph>()}),
    });

    const minMapped = this.min.flatMap(this.validateMin);
    minMapped.onValue(
      v => this.setState({ min: Just(v) })
    ).onError(
      v => this.setState({ min: Just(v), finalObject: Nothing<Rdf.Graph>() })
    );

    const maxMapped = this.max.flatMap(this.validateMax);
    maxMapped.onValue(
      v => this.setState({ max: Just(v) })
    ).onError(
      v => this.setState({ max: Just(v), finalObject: Nothing<Rdf.Graph>() })
    );

    const subjectMapped = this.testSubject.map<Value>( v => ({value: v}));
    subjectMapped.onValue(
      v => this.setState({ testSubject: Just(v) })
    ).onError(
      v => this.setState({ testSubject: Just(v), finalObject: Nothing<Rdf.Graph>() })
    );

    const defaultsMapped = this.defaultValues.flatMap<Value[]>(this.validateDefaults);
    defaultsMapped.onValue(
      vs => this.setState({defaults: vs})
    ).onError(
      vs => this.setState({defaults: vs, finalObject: Nothing<Rdf.Graph>()})
    );

    const insertMapped = this.insert.flatMap(this.validateInsert);
    insertMapped.observe({
      value: v => this.setState({insertPattern: Just(v)}),
      error: (v: Value) => this.setState({
        insertPattern: Just(v),
        finalObject: Nothing<Rdf.Graph>(),
      })
    });

    const selectMapped = this.select.flatMap(this.validateSelect);
    selectMapped.observe({
      value: v => this.setState({selectPattern: Just(v)}),
      error: (v: Value) => this.setState({
        selectPattern: Just(v),
        finalObject: Nothing<Rdf.Graph>(),
      })
    });

    const deleteMapped = this.delete.flatMap(this.validateDelete);
    deleteMapped.observe({
      value: v => this.setState({deletePattern: Just(v)}),
      error: (v: Value) => this.setState({
        deletePattern: Just(v),
        finalObject: Nothing<Rdf.Graph>(),
      })
    });

    const askMapped = this.ask.flatMap(this.validateAsk);
    askMapped.observe({
      value: v => this.setState({askPattern: Just(v)}),
      error: (v: Value) => this.setState({
        askPattern: Just(v),
        finalObject: Nothing<Rdf.Graph>(),
      })
    });

    const valuesetMapped = this.valueset.flatMap(this.validateValueset);
    valuesetMapped.observe({
      value: v => this.setState({valueSetPattern: Just(v)}),
      error: (v: Value) => this.setState({
        valueSetPattern: Just(v),
        finalObject: Nothing<Rdf.Graph>(),
      })
    });

    const autosuggestionMapped = this.autosuggestion.flatMap(this.validateAutosuggestion);
    autosuggestionMapped.observe({
      value: v => this.setState({autosuggestionPattern: Just(v)}),
      error: (v: Value) => this.setState({
        autosuggestionPattern: Just(v),
        finalObject: Nothing<Rdf.Graph>(),
      })
    });

    const nothing = (): undefined => undefined;
    // combine all streams as soon as one changes
    Kefir.combine({
      id: iriMapped.toProperty(nothing),
      label: labelMapped.toProperty(nothing),
      description: descriptionMapped.toProperty(nothing),
      categories: this.categories.toProperty(() => []),
      domain: domainMapped.toProperty(nothing),
      xsdDatatype: xsdMapped.toProperty(nothing),
      range: rangeMapped.toProperty(nothing),
      min: minMapped.toProperty(nothing),
      max: maxMapped.toProperty(nothing),
      defaultValues: defaultsMapped.map<string[]>(vs => vs.map(v => v.value)).toProperty(
        () => this.state.defaults.map(v => v.value)
      ),
      testSubject: subjectMapped.toProperty(nothing),
      insertPattern: insertMapped.toProperty(nothing).debounce(200),
      selectPattern: selectMapped.toProperty(nothing).debounce(200),
      deletePattern: deleteMapped.toProperty(nothing).debounce(200),
      askPattern: askMapped.toProperty(nothing).debounce(200),
      valueSetPattern: valuesetMapped.toProperty(nothing).debounce(200),
      autosuggestionPattern: autosuggestionMapped.toProperty(nothing).debounce(200),
    }).onValue(() => {
      // this is workaround for many bugs that happens because we mix properties and setState,
      // with this approach we can make sure that tryCreateFinalGraph is called after all setState calls
      // in properties are completed
      // TODO we should fully revise this component, it is very very fragile
      this.setState(() => ({}), () => this.tryCreateFinalGraph());
    });
  }

  private tryCreateFinalGraph() {
    const fields = unwrapState(this.state);

    // ignore these cases where iri, label or insert are undefined
    if (!fields.id || !fields.label || !fields.insertPattern) {
      return;
    }

    const graph = createFieldDefinitionGraph(fields);
    this.setState({finalObject: Just(graph)});
  }

  /**
   * Returns a valid IRI value observable if supplied value is valid IRI string,
   * an error observable otherwise.
   */
  private validateIri = (v: string): Kefir.Property<Value> => {
    if (!N3.Util.isIRI(v)) {
      return Kefir.constantError<Value>({
        value: v,
        error: new Error('Identifier must be a valid full IRI string.'),
      });
    }
    return Kefir.constant<Value>({value: v});
  }

  private generateIriFromLabel = (v: string): void => {
    if (this.state.id.isNothing) {
      this.id.plug(
        Kefir.constant<string>(this.getFieldInstanceIriBase() + encodeURIComponent(v))
      );
    }
  }

  private generateIRI = () => {
    const local = this.state.label.isJust
      ? encodeURIComponent(this.state.label.get().value)
      : Date.now();
    this.id.plug(
      Kefir.constant<string>(this.getFieldInstanceIriBase() + local)
    );
  }

  /**
   * Returns a valid value (SPARQL select) string if supplied queryString is a valid
   * SPARQL SELECT query and fulfills all constraints e.g. has at least ?value ?subject
   * projection variable.
   * Returns an error observable otherwise.
   */
  private validateLabel = (v: string): Kefir.Property<Value> => {
    if (v.length < 5) {
      return Kefir.constantError<Value>({
        value: v,
        error: new Error('Label should be meaningful and have at least five characters.'),
      });
    }
    return Kefir.constant<Value>({value: v});
  }

  /**
   * Returns a valid min value observable if value is >= 0, an error observable otherwise.
   */
  private validateMin = (v: string): Kefir.Property<Value> => {
    if ( !(parseInt(v) >= 0)) {
      return Kefir.constantError<Value>({
        value: v,
        error: new Error('Min. Cardinality must be >= 0'),
      });
    }
    return Kefir.constant<Value>({value: v});
  }

  /**
   * Returns a valid max observable value if value is >=1 or unbound, an error observable otherwise.
   */
  private validateMax = (v: string): Kefir.Property<Value> => {
    if ( !(parseInt(v) >= 1 || v === 'unbound') ) {
      return Kefir.constantError<Value>({
        value: v,
        error: new Error('Max. Cardinality must be >= 1 or unbound'),
      });
    }
    return Kefir.constant<Value>({value: v});
  }

  private validateDefaults = (vs: string[]): Kefir.Property<Value[]> => {
    // ToDo: validate defaults against type of field
    return Kefir.constant<Value[]>(vs.map(v => ({value: v})));
  }

  /**
   * Nothing to validate here as of now, emits always a valid observable value.
   */
  private validateDescription = (v: string): Kefir.Property<Value> => {
    return Kefir.constant<Value>({value: v});
  }

  /**
   * Returns a valid value (SPARQL insert) observable if supplied queryString is a valid
   * SPARQL INSERT query and fulfills all constraints e.g. containing ?value ?subject.
   * Returns an error observable otherwise.
   */
  private validateInsert = (queryString: string): Kefir.Property<Value> => {
    const msg = `Insert pattern must be a valid SPARQL UPDATE INSERT query
      and must have a $subject and $value variable.`;
    return this.validateQuery(queryString, true, true, 'insertdelete', msg);
  }

  /**
   * Returns a valid value  (SPARQL delete) observable if supplied queryString is a valid
   * SPARQL DELETE query and fulfills all constraints e.g. containing ?value ?subject.
   * Returns an error observable otherwise.
   */
  private validateDelete = (queryString: string): Kefir.Property<Value> => {
    const msg = `Delete pattern must be a valid SPARQL UPDATE DELETE query
                  and must have a $subject and $value variable.`;
    return this.validateQuery(queryString, true, true, 'insertdelete', msg);
  }

  /**
   * Returns a valid value (SPARQL select) observable if supplied queryString is a valid
   * SPARQL SELECT query and fulfills all constraints e.g. containing ?value ?subject.
   * Returns an error observable otherwise.
   */
  private validateSelect = (queryString: string): Kefir.Property<Value> => {
    const msg = `Select pattern must be a valid SPARQL SELECT query
        and must have a $subject and $value variable
        and must expose a ?value projection variable.`;
    return this.validateQuery(queryString, true, true, 'SELECT', msg, ['value']);
  }

  /**
   * Returns a valid value (SPARQL ask) observable if supplied queryString is a valid
   * SPARQL ask query and fulfills all constraints.
   * Returns an error observable otherwise.
   */
  private validateAsk = (queryString: string): Kefir.Property<Value> => {
    const msg = `Ask validation pattern must be a valid SPARQL ASK query.`;
    return this.validateQuery(queryString, undefined, undefined, 'ASK', msg);
  }

  /**
   * Returns a valid value (SPARQL select) observable if supplied queryString is a valid
   * SPARQL SELECT query and fulfills all constraints e.g. has at least ?value ?subject
   * projection variable.
   * Returns an error observable otherwise.
   */
  private validateValueset = (queryString: string): Kefir.Property<Value> => {
    const msg = `Select valueset pattern must be a valid SPARQL SELECT query
          and must expose a ?value projection variable.`;
    return this.validateQuery(queryString, undefined, undefined, 'SELECT', msg, ['value']);
  }

  /**
   * Returns a valid value (SPARQL select) observable if supplied queryString is a valid
   * SPARQL SELECT query and fulfills all constraints e.g. has at least ?value ?subject
   * projection variable.
   * Returns an error observable otherwise.
   */
  private validateAutosuggestion = (queryString: string): Kefir.Property<Value> => {
    const msg = `Select autosuggestion pattern must be a valid SPARQL SELECT query
        and must expose a ?value and ?label projection variable.`;
    // TODO check also on existence of ?token, needs to be done with string contains
    // const containsToken = queryString.indexOf('"?token"')  !== -1;
    return this.validateQuery(queryString, undefined, undefined, 'SELECT', msg, ['value', 'label']);
  }

  private validateQuery = (
    query: string,
    hasSubject: boolean,
    hasValue: boolean,
    queryType: string,
    errorMsg: string,
    projectionVariables: string[] = []
  ): Kefir.Property<Value> => {
    return SparqlUtil.parseQueryAsync(query).flatMap<Value>(q => {
      const info = this.getQueryInfo(q);
      if (
        (hasValue === undefined || info.hasValue === hasValue) &&
        (hasSubject === undefined || info.hasSubject === hasSubject) &&
        (info.type === queryType) &&
        (intersection(info.projectionVariables, projectionVariables).length
          === projectionVariables.length
        )
      ) {
        return Kefir.constant<Value>({value: query});
      } else {
        return Kefir.constantError<Value>({
          value: query,
          error: new Error(errorMsg),
        });
      }
    }).flatMapErrors<Value>(e => {
      return Kefir.constantError<Value>({
          value: query,
          error: e.error ? e.error : new Error(e.message),
        });
    }).toProperty();
  }

  /**
   * Traverses the query AST of the specified {@SparqlJs.SparqlQuery} and
   * collects information into a {@QueryInfo} object including information on the
   * query type and whether certain variables exist.
   *
   * In addition we collect extract information of which projection variables are being used.
   */
  private getQueryInfo = (q: SparqlJs.SparqlQuery): QueryInfo => {

    const visitor = new (class extends QueryVisitor {
      public hasSubject = false;
      public hasValue = false;
      public queryType = undefined;
      variableTerm(variable: SparqlJs.Term) {
        const name = variable.substr(1);
        if (name === 'subject') {
          this.hasSubject = true;
        }else if (name === 'value') {
          this.hasValue = true;
        }
        return super.variableTerm(variable);
      }

      query(query: SparqlJs.Query): SparqlJs.Query {
        this.queryType  = query.queryType;
        return super.query(query);
      }

      insertDelete(operation: SparqlJs.InsertDeleteOperation) {
        this.queryType  = operation.updateType;
        return super.insertDelete(operation);
      }

    });
    const queryCopy = cloneQuery(q) as SparqlJs.SelectQuery;
    visitor.sparqlQuery(queryCopy);

    const projectionVariables = (
      queryCopy.variables && !SparqlTypeGuards.isStarProjection(queryCopy.variables)
    ) ? queryCopy.variables.map(
      v => SparqlTypeGuards.isTerm(v) ? v.substr(1) : v.variable.substr(1)
    ) : [];

    return {
      type: visitor.queryType,
      hasSubject: visitor.hasSubject,
      hasValue: visitor.hasValue,
      projectionVariables: projectionVariables,
    };
  }

  /**
   * Returns base IRI to be used for storing new field definitions.
   * If not configured as attribute on the field editor, it will return a
   * standard {@FIELD_DEF_INSTANCE_BASE}.
   */
  private getFieldInstanceIriBase = (): string => {
    return this.props.fieldInstanceBaseIri
      ? this.props.fieldInstanceBaseIri
      : FIELD_DEF_INSTANCE_BASE;
  }

  /**
   * Simple helper to convert the current value of any HTMLInputElement into
   * a Kefir observable.
   */
  private getFormValue =
    (
      e: FormEvent<ReactBootstrap.FormControl> | ChangeEvent<HTMLTextAreaElement>
    ): Kefir.Property<any> => {
      return Kefir.constant((e.target as any).value);
    }

  /**
   * Action for save or update button. Saves the graph (i.e. the field definition)
   * using LDP api.
   */
  private onSaveOrUpdate = (e: MouseEvent<ReactBootstrap.Button>) => {
    e.stopPropagation();
    e.preventDefault();
    const graph = this.state.finalObject.get();
    const ldp = new LdpService(
      vocabularies.VocabPlatform.FieldDefinitionContainer.value
    );

    if (this.isEditMode()) {
      ldp.update(Rdf.iri(this.state.id.get().value), graph)
        .onValue(() => window.location.reload());
     } else {
       return ldp.addResource(graph, Just(this.state.id.get().value))
        .flatMap(newResourceIri => navigateToResource(newResourceIri, {}, 'assets'))
        .onValue(v => v);
     }
  }
}

export type component = FieldEditorComponent;
export const component = FieldEditorComponent;
export const factory = createFactory(component);
export default component;
